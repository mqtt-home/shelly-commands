package shelly

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/mqtt-home/shelly-commands/config"
	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/mqtt"
)

type ShadingActor struct {
	device       config.Device
	Name         string
	TopicBase    string
	Serial       string
	Config       config.BlindsConfig
	DeviceType   config.DeviceType
	Tilted       bool
	TiltPosition int
	Position     int
	mu           sync.Mutex
}

func NewShadingActor(device config.Device) *ShadingActor {
	actor := &ShadingActor{
		device:     device,
		Name:       device.Name,
		TopicBase:  device.TopicBase,
		Config:     device.BlindsConfig,
		DeviceType: device.DeviceType,
		Tilted:     false,
	}
	err := actor.init()
	if err != nil {
		panic(err)
	}
	return actor
}

func (s *ShadingActor) init() error {
	return nil
}

func (s *ShadingActor) DisplayName() string {
	return s.Name
}

func (s *ShadingActor) String() string {
	return fmt.Sprintf("ShadingActor{name: %s; topic_base: %s; type: %s}", s.Name, s.TopicBase, s.DeviceType)
}

func (s *ShadingActor) IsRollerShutter() bool {
	return s.DeviceType == config.DeviceTypeRollerShutter
}

func (s *ShadingActor) IsBlinds() bool {
	return s.DeviceType == config.DeviceTypeBlinds
}

func (s *ShadingActor) Start() error {
	mqtt.Subscribe(s.TopicBase+"/status/cover:0", func(topic string, payload []byte) {
		logger.Debug("Received MQTT message", topic, string(payload))

		status := &Status{}

		err := json.Unmarshal(payload, status)
		if err != nil {
			logger.Error("Failed to parse status", s, err)
			return
		}

		// Safely update position with mutex
		s.mu.Lock()
		oldPosition := s.Position
		oldTiltPosition := s.TiltPosition
		s.Position = status.CurrentPos
		s.TiltPosition = status.SlatPos
		s.Tilted = status.SlatPos != 0
		s.mu.Unlock()

		logger.Debug("Position updated", s.Name, "from", oldPosition, "to", status.CurrentPos, "tilt from", oldTiltPosition, "to", status.SlatPos)

		// Non-blocking send to position change channel
		event := PositionChangeEvent{ActorName: s.Name, Position: status.CurrentPos, SlatPosition: status.SlatPos}
		select {
		case PositionChangeChan <- event:
			logger.Debug("Position change event sent", s.Name, status.CurrentPos)
		default:
			logger.Warn("Position change channel is full, dropping event", s.Name, status.CurrentPos)
		}
	})

	mqtt.PublishAbsolute(s.TopicBase+"/command/cover:0", "status_update", false)
	logger.Info("Actor started and subscribed to MQTT", s.Name, s.TopicBase)

	return nil
}
