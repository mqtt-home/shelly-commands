package shelly

import (
	"strings"
	"sync"
)

type ActorRegistry struct {
	Actors map[string]*ShadingActor
	mu     sync.RWMutex
}

func NewActorRegistry() *ActorRegistry {
	return &ActorRegistry{
		Actors: make(map[string]*ShadingActor),
	}
}

func (r *ActorRegistry) AddActor(actor *ShadingActor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Actors[strings.ToLower(actor.Name)] = actor
}

func (r *ActorRegistry) GetActor(name string) *ShadingActor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Actors[strings.ToLower(name)]
}

func (r *ActorRegistry) GetActorBySN(sn string) *ShadingActor {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, actor := range r.Actors {
		if actor.Serial == sn {
			return actor
		}
	}

	return nil
}

func (r *ActorRegistry) GetAllActors() []*ShadingActor {
	r.mu.RLock()
	defer r.mu.RUnlock()

	actors := make([]*ShadingActor, 0, len(r.Actors))
	for _, actor := range r.Actors {
		actors = append(actors, actor)
	}
	return actors
}
