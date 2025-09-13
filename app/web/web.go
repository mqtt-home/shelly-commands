package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/shelly"
	"github.com/philipparndt/go-logger"
	loggerchi "github.com/philipparndt/go-logger-chi"
)

// SSE client connection
type SSEClient struct {
	ID      string
	Channel chan string
	Request *http.Request
	Writer  http.ResponseWriter
}

type WebServer struct {
	registry      *shelly.ActorRegistry
	router        *chi.Mux
	sseClients    map[string]*SSEClient
	sseClients_mu sync.RWMutex
}

type ActorStatus struct {
	Name         string `json:"name"`
	DisplayName  string `json:"displayName"`
	IP           string `json:"ip"`
	Serial       string `json:"serial"`
	Position     int    `json:"position"`
	Tilted       bool   `json:"tilted"`
	TiltPosition int    `json:"tiltPosition"`
	DeviceType   string `json:"deviceType"`
	Rank         int    `json:"rank"`
	GroupID      string `json:"groupId"`
}

type TiltRequest struct {
	Position int `json:"position"`
}

type SetPositionRequest struct {
	Position int `json:"position"`
}

func NewWebServer(registry *shelly.ActorRegistry) *WebServer {
	ws := &WebServer{
		registry:   registry,
		router:     chi.NewRouter(),
		sseClients: make(map[string]*SSEClient),
	}
	ws.setupRoutes()
	return ws
}

func (ws *WebServer) setupRoutes() {
	ws.router.Use(loggerchi.Middleware())
	ws.router.Use(middleware.Recoverer)

	// CORS configuration
	ws.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API routes
	ws.router.Route("/api", func(r chi.Router) {
		r.Get("/health", ws.healthCheck)
		r.Get("/actors", ws.getAllActors)
		r.Get("/actors/{actorName}", ws.getActor)
		r.Post("/actors/{actorName}/position", ws.setActorPosition)
		r.Post("/actors/{actorName}/tilt", ws.tiltActor)
		r.Post("/actors/{actorName}/slat", ws.setSlatPosition)
		r.Post("/actors/all/position", ws.setAllActorsPosition)
		r.Post("/actors/all/tilt", ws.tiltAllActors)
		r.Post("/actors/all/slat", ws.setSlatPositionAll)
		r.Get("/groups", ws.getAllGroups)
		r.Post("/groups/{groupId}/position", ws.setGroupPosition)
		r.Post("/groups/{groupId}/tilt", ws.tiltGroup)
		r.Post("/groups/{groupId}/slat", ws.setSlatPositionGroup)
		r.Get("/events", ws.handleSSE)
	})

	// SSE route
	ws.router.Get("/events", ws.handleSSE)

	// Serve static files (React app)
	fileServer := http.FileServer(http.Dir("./web/dist/"))
	ws.router.Handle("/*", fileServer)
}

func (ws *WebServer) healthCheck(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":     "ok",
		"goroutines": runtime.NumGoroutine(),
		"actors":     len(ws.registry.GetAllActors()),
		"sse_clients": func() int {
			ws.sseClients_mu.RLock()
			defer ws.sseClients_mu.RUnlock()
			return len(ws.sseClients)
		}(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func (ws *WebServer) getAllActors(w http.ResponseWriter, r *http.Request) {
	var actors []ActorStatus

	for _, actor := range ws.registry.Actors {
		// Get current position
		position, err := actor.GetPosition()
		if err != nil {
			logger.Error("Failed to get position for actor", actor.Name, err)
			position = actor.Position // fallback to cached position
		}

		status := ActorStatus{
			Name:         actor.Name,
			DisplayName:  actor.DisplayName(),
			IP:           actor.TopicBase,
			Serial:       actor.Serial,
			Position:     position,
			Tilted:       actor.Tilted,
			TiltPosition: actor.TiltPosition,
			DeviceType:   string(actor.DeviceType),
			Rank:         actor.Rank,
			GroupID:      actor.GroupID,
		}
		actors = append(actors, status)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(actors)
}

func (ws *WebServer) getActor(w http.ResponseWriter, r *http.Request) {
	actorName := chi.URLParam(r, "actorName")
	actor := ws.registry.GetActor(actorName)

	if actor == nil {
		http.Error(w, fmt.Sprintf("Actor '%s' not found", actorName), http.StatusNotFound)
		return
	}

	// Get current position
	position, err := actor.GetPosition()
	if err != nil {
		logger.Error("Failed to get position for actor", actor.Name, err)
		position = actor.Position // fallback to cached position
	}

	status := ActorStatus{
		Name:         actor.Name,
		DisplayName:  actor.DisplayName(),
		IP:           actor.TopicBase,
		Serial:       actor.Serial,
		Position:     position,
		Tilted:       actor.Tilted,
		TiltPosition: actor.TiltPosition,
		DeviceType:   string(actor.DeviceType),
		Rank:         actor.Rank,
		GroupID:      actor.GroupID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (ws *WebServer) setActorPosition(w http.ResponseWriter, r *http.Request) {
	actorName := chi.URLParam(r, "actorName")
	actor := ws.registry.GetActor(actorName)

	if actor == nil {
		http.Error(w, fmt.Sprintf("Actor '%s' not found", actorName), http.StatusNotFound)
		return
	}

	var req SetPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSet,
		Position: req.Position,
	}

	go actor.Apply(command)

	logger.Info(fmt.Sprintf("Set position for actor %s to %d", actorName, req.Position))

	// Broadcast state change after a brief delay to allow the actor to update
	go func() {
		time.Sleep(500 * time.Millisecond)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (ws *WebServer) tiltActor(w http.ResponseWriter, r *http.Request) {
	actorName := chi.URLParam(r, "actorName")
	actor := ws.registry.GetActor(actorName)

	if actor == nil {
		http.Error(w, fmt.Sprintf("Actor '%s' not found", actorName), http.StatusNotFound)
		return
	}

	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionTilt,
		Position: req.Position,
	}

	go actor.Apply(command)

	logger.Info(fmt.Sprintf("Tilt actor %s to position %d", actorName, req.Position))

	// Broadcast state change after a brief delay to allow the actor to update
	go func() {
		time.Sleep(500 * time.Millisecond)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (ws *WebServer) tiltAllActors(w http.ResponseWriter, r *http.Request) {
	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionTilt,
		Position: req.Position,
	}

	tiltedCount := 0
	for _, actor := range ws.registry.Actors {
		go actor.Apply(command)
		tiltedCount++
	}

	logger.Info(fmt.Sprintf("Tilt all %d actors to position %d", tiltedCount, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  tiltedCount,
	})
}

func (ws *WebServer) setSlatPosition(w http.ResponseWriter, r *http.Request) {
	actorName := chi.URLParam(r, "actorName")
	actor := ws.registry.GetActor(actorName)

	if actor == nil {
		http.Error(w, fmt.Sprintf("Actor '%s' not found", actorName), http.StatusNotFound)
		return
	}

	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSlat,
		Position: req.Position,
	}

	go actor.Apply(command)

	logger.Info(fmt.Sprintf("Set slat position for actor %s to %d", actorName, req.Position))

	// Broadcast state change after a brief delay to allow the actor to update
	go func() {
		time.Sleep(500 * time.Millisecond)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (ws *WebServer) setSlatPositionAll(w http.ResponseWriter, r *http.Request) {
	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSlat,
		Position: req.Position,
	}

	slatCount := 0
	for _, actor := range ws.registry.Actors {
		go actor.Apply(command)
		slatCount++
	}

	logger.Info(fmt.Sprintf("Set slat position for all %d actors to %d", slatCount, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  slatCount,
	})
}

func (ws *WebServer) setAllActorsPosition(w http.ResponseWriter, r *http.Request) {
	var req SetPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSet,
		Position: req.Position,
	}

	affectedCount := 0
	for _, actor := range ws.registry.Actors {
		go actor.Apply(command)
		affectedCount++
	}

	logger.Info(fmt.Sprintf("Set position for all %d actors to %d", affectedCount, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  affectedCount,
	})
}

// Group-related types and handlers
type GroupInfo struct {
	GroupID    string        `json:"groupId"`
	Name       string        `json:"name"`
	ActorCount int           `json:"actorCount"`
	Actors     []ActorStatus `json:"actors"`
}

func (ws *WebServer) getAllGroups(w http.ResponseWriter, r *http.Request) {
	groupMap := make(map[string]*GroupInfo)

	// Collect all actors and group them
	for _, actor := range ws.registry.Actors {
		if actor.GroupID == "" {
			continue // Skip actors without group
		}

		// Get current position
		position, err := actor.GetPosition()
		if err != nil {
			logger.Error("Failed to get position for actor", actor.Name, err)
			position = actor.Position // fallback to cached position
		}

		status := ActorStatus{
			Name:         actor.Name,
			DisplayName:  actor.DisplayName(),
			IP:           actor.TopicBase,
			Serial:       actor.Serial,
			Position:     position,
			Tilted:       actor.Tilted,
			TiltPosition: actor.TiltPosition,
			DeviceType:   string(actor.DeviceType),
			Rank:         actor.Rank,
			GroupID:      actor.GroupID,
		}

		if group, exists := groupMap[actor.GroupID]; exists {
			group.Actors = append(group.Actors, status)
			group.ActorCount++
		} else {
			groupMap[actor.GroupID] = &GroupInfo{
				GroupID:    actor.GroupID,
				Name:       actor.GroupID, // Use GroupID as name for now
				ActorCount: 1,
				Actors:     []ActorStatus{status},
			}
		}
	}

	// Convert map to slice
	var groups []GroupInfo
	for _, group := range groupMap {
		groups = append(groups, *group)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func (ws *WebServer) setGroupPosition(w http.ResponseWriter, r *http.Request) {
	groupID := chi.URLParam(r, "groupId")

	var req SetPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSet,
		Position: req.Position,
	}

	affectedCount := 0
	for _, actor := range ws.registry.Actors {
		if actor.GroupID == groupID {
			go actor.Apply(command)
			affectedCount++
		}
	}

	if affectedCount == 0 {
		http.Error(w, fmt.Sprintf("No actors found in group '%s'", groupID), http.StatusNotFound)
		return
	}

	logger.Info(fmt.Sprintf("Set position for %d actors in group %s to %d", affectedCount, groupID, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  affectedCount,
		"group":  groupID,
	})
}

func (ws *WebServer) tiltGroup(w http.ResponseWriter, r *http.Request) {
	groupID := chi.URLParam(r, "groupId")

	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionTilt,
		Position: req.Position,
	}

	affectedCount := 0
	for _, actor := range ws.registry.Actors {
		if actor.GroupID == groupID {
			go actor.Apply(command)
			affectedCount++
		}
	}

	if affectedCount == 0 {
		http.Error(w, fmt.Sprintf("No actors found in group '%s'", groupID), http.StatusNotFound)
		return
	}

	logger.Info(fmt.Sprintf("Tilt %d actors in group %s to position %d", affectedCount, groupID, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  affectedCount,
		"group":  groupID,
	})
}

func (ws *WebServer) setSlatPositionGroup(w http.ResponseWriter, r *http.Request) {
	groupID := chi.URLParam(r, "groupId")

	var req TiltRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Position < 0 || req.Position > 100 {
		http.Error(w, "Position must be between 0 and 100", http.StatusBadRequest)
		return
	}

	command := commands.LLCommand{
		Action:   commands.LLActionSlat,
		Position: req.Position,
	}

	affectedCount := 0
	for _, actor := range ws.registry.Actors {
		if actor.GroupID == groupID {
			go actor.Apply(command)
			affectedCount++
		}
	}

	if affectedCount == 0 {
		http.Error(w, fmt.Sprintf("No actors found in group '%s'", groupID), http.StatusNotFound)
		return
	}

	logger.Info(fmt.Sprintf("Set slat position for %d actors in group %s to %d", affectedCount, groupID, req.Position))

	// Broadcast state change after a brief delay to allow the actors to update
	go func() {
		time.Sleep(1 * time.Second)
		ws.broadcastStateChange()
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  affectedCount,
		"group":  groupID,
	})
}

func (ws *WebServer) handleSSE(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Generate a unique ID for the client
	clientID := fmt.Sprintf("%d", time.Now().UnixNano())
	logger.Info(fmt.Sprintf("SSE client connected: %s", clientID))

	// Create a channel for the client
	channel := make(chan string, 10)

	// Register the client
	ws.sseClients_mu.Lock()
	ws.sseClients[clientID] = &SSEClient{
		ID:      clientID,
		Channel: channel,
		Request: r,
		Writer:  w,
	}
	ws.sseClients_mu.Unlock()

	// Send initial state
	actorsState := ws.getAllActorsState()
	message, _ := json.Marshal(actorsState)
	fmt.Fprintf(w, "data: %s\n\n", string(message))

	flusher, ok := w.(http.Flusher)
	if ok {
		flusher.Flush()
	}

	// Start periodic updates - reduced frequency for better performance
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Handle client connection
	defer func() {
		logger.Info(fmt.Sprintf("SSE client disconnected: %s", clientID))
		ws.sseClients_mu.Lock()
		delete(ws.sseClients, clientID)
		close(channel)
		ws.sseClients_mu.Unlock()
	}()

	for {
		select {
		case msg := <-shelly.PositionChangeChan:
			logger.Debug("Received position change event for SSE", msg.ActorName, msg.Position, "client", clientID)
			actorsState := ws.getAllActorsState()
			message, err := json.Marshal(actorsState)
			if err != nil {
				logger.Error("Failed to marshal actors state for SSE position change", err)
				continue
			}
			_, writeErr := fmt.Fprintf(w, "data: %s\n\n", string(message))
			if writeErr != nil {
				logger.Error("Failed to write SSE position change message", writeErr, "client", clientID)
				return
			}
			if ok {
				flusher.Flush()
			}
		case <-r.Context().Done():
			logger.Debug("SSE client context done", clientID)
			return
		case <-ticker.C:
			logger.Debug("SSE periodic update", clientID)
			actorsState := ws.getAllActorsState()
			message, err := json.Marshal(actorsState)
			if err != nil {
				logger.Error("Failed to marshal actors state for SSE periodic update", err)
				continue
			}
			_, writeErr := fmt.Fprintf(w, "data: %s\n\n", string(message))
			if writeErr != nil {
				logger.Error("Failed to write SSE periodic message", writeErr, "client", clientID)
				return
			}
			if ok {
				flusher.Flush()
			}
		case msg := <-channel:
			logger.Debug("SSE broadcast message", clientID)
			_, writeErr := fmt.Fprintf(w, "data: %s\n\n", msg)
			if writeErr != nil {
				logger.Error("Failed to write SSE broadcast message", writeErr, "client", clientID)
				return
			}
			if ok {
				flusher.Flush()
			}
		}
	}
}

// Broadcast state changes to all SSE clients
func (ws *WebServer) broadcastStateChange() {
	actorsState := ws.getAllActorsState()
	message, err := json.Marshal(actorsState)
	if err != nil {
		logger.Error("Failed to marshal actors state for SSE broadcast", err)
		return
	}
	messageStr := string(message)

	ws.sseClients_mu.RLock()
	clientCount := len(ws.sseClients)
	for clientID, client := range ws.sseClients {
		select {
		case client.Channel <- messageStr:
			// Message sent successfully
		default:
			// Channel full, skip this client
			logger.Warn(fmt.Sprintf("SSE client channel full, skipping: %s", clientID))
		}
	}
	ws.sseClients_mu.RUnlock()

	if clientCount > 0 {
		logger.Debug(fmt.Sprintf("Broadcasted state change to %d SSE clients", clientCount))
	}
}

func (ws *WebServer) getAllActorsState() []ActorStatus {
	var actorsState []ActorStatus

	for _, actor := range ws.registry.Actors {
		// Get current position
		position, err := actor.GetPosition()
		if err != nil {
			logger.Error("Failed to get position for actor", actor.Name, err)
			position = actor.Position // fallback to cached position
		}

		state := ActorStatus{
			Name:         actor.Name,
			DisplayName:  actor.DisplayName(),
			IP:           actor.TopicBase,
			Serial:       actor.Serial,
			Position:     position,
			Tilted:       actor.Tilted,
			TiltPosition: actor.TiltPosition,
			DeviceType:   string(actor.DeviceType),
			Rank:         actor.Rank,
			GroupID:      actor.GroupID,
		}
		actorsState = append(actorsState, state)
	}

	return actorsState
}

func (ws *WebServer) Start(port int) error {
	addr := ":" + strconv.Itoa(port)
	logger.Info(fmt.Sprintf("Starting web server on %s", addr))
	return http.ListenAndServe(addr, ws.router)
}
