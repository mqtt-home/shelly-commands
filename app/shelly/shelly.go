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
	Tilted       bool
	TiltPosition int
	Position     int
	mu           sync.Mutex
}

func NewShadingActor(device config.Device) *ShadingActor {
	actor := &ShadingActor{
		device:    device,
		Name:      device.Name,
		TopicBase: device.TopicBase,
		Config:    device.BlindsConfig,
		Tilted:    false,
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
	return fmt.Sprintf("ShadingActor{name: %s; topic_base: %s}", s.Name, s.TopicBase)
}

func (s *ShadingActor) Start() error {
	mqtt.Subscribe(s.TopicBase+"/status/cover:0", func(topic string, payload []byte) {
		logger.Debug("Received message", topic, string(payload))

		status := &Status{}

		err := json.Unmarshal(payload, status)
		if err != nil {
			logger.Error("Failed to parse status", s, err)
			return
		}

		s.Position = status.CurrentPos
		s.TiltPosition = status.SlatPos
		s.Tilted = status.SlatPos != 0

		PositionChangeChan <- PositionChangeEvent{ActorName: s.Name, Position: status.CurrentPos, SlatPosition: status.SlatPos}
	})

	mqtt.PublishAbsolute(s.TopicBase+"/command/cover:0", "status_update", false)

	return nil
}
