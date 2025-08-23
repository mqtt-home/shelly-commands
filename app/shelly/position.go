package shelly

import (
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/mqtt-home/shelly-commands/retry"
	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/mqtt"
)

// PositionChangeEvent is sent to the global channel when an actor's position changes
// You can extend this struct with more fields if needed
// e.g. Tilt, Serial, etc.
type PositionChangeEvent struct {
	ActorName    string
	Position     int
	SlatPosition int
}

var PositionChangeChan = make(chan PositionChangeEvent, 100)

func (s *ShadingActor) GetPosition() (int, error) {
	wg := sync.WaitGroup{}
	wg.Add(1)

	return retry.Times[int](3, func() (int, error) {
		return s.getPosition()
	})
}

func (s *ShadingActor) getPosition() (int, error) {
	return s.Position, nil
}

func (s *ShadingActor) SetPosition(position int) (bool, error) {
	if position < 0 || position > 100 {
		return false, fmt.Errorf("invalid position")
	}
	// see:
	// https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover#mqtt-control

	mqtt.PublishAbsolute(s.TopicBase+"/command/cover:0", "pos,"+strconv.Itoa(position), false)

	return true, nil
}

func (s *ShadingActor) SetSlatPosition(position int) (bool, error) {
	if position < 0 || position > 100 {
		return false, fmt.Errorf("invalid slat position")
	}

	// see:
	// https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Cover#mqtt-control

	mqtt.PublishAbsolute(s.TopicBase+"/command/cover:0", "slat_pos,"+strconv.Itoa(position), false)

	return true, nil
}

func (s *ShadingActor) WaitForPosition(waitGroup *sync.WaitGroup, position int, timeout int) error {
	if position < 0 || position > 100 {
		return fmt.Errorf("invalid position")
	}

	waitGroup.Add(1)

	go func() {
		defer waitGroup.Done()
		startTime := time.Now()

		for {
			currentPosition, err := s.GetPosition()
			if err != nil {
				logger.Error("Failed to get position", err)
				return
			}
			if currentPosition == position {
				logger.Debug(fmt.Sprintf("Position %d reached", position))
				return
			}

			logger.Debug(fmt.Sprintf("Waiting for position %d (current: %d)", position, currentPosition))
			if time.Since(startTime).Seconds() > float64(timeout) {
				logger.Error("Timeout waiting for position")
				return
			}

			time.Sleep(500 * time.Millisecond)
		}
	}()

	return nil
}

func (s *ShadingActor) SetAndWaitForPosition(waitGroup *sync.WaitGroup, position int, timeout int) error {
	if position < 0 || position > 100 {
		return fmt.Errorf("invalid position")
	}

	_, err := s.SetPosition(position)
	if err != nil {
		return err
	}

	return s.WaitForPosition(waitGroup, position, timeout)
}
