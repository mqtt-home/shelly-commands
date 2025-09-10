package shelly

import (
	"sync"
	"time"

	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/config"
	"github.com/philipparndt/go-logger"
)

func (s *ShadingActor) Apply(command commands.LLCommand) {
	logger.Info("Applying command", s.Name, "action", command.Action, "position", command.Position, "device_type", s.DeviceType)

	switch command.Action {
	case commands.LLActionSet:
		_, err := s.SetPosition(command.Position)
		if err != nil {
			logger.Error("Failed setting position", s.Name, err)
		} else {
			logger.Info("Set position command completed", s.Name, "position", command.Position)
		}
	case commands.LLActionTilt:
		if s.IsRollerShutter() {
			logger.Info("Ignoring tilt command for roller shutter", s.Name)
			return
		}
		s.Tilt(command.Position)
	case commands.LLActionSlat:
		if s.IsRollerShutter() {
			logger.Info("Ignoring slat command for roller shutter", s.Name)
			return
		}
		s.SlatOnly(command.Position)
	}

	logger.Debug("Command application finished", s.Name, "action", command.Action)
}

func (s *ShadingActor) Tilt(position int) {
	logger.Info("Tilt command started", s.Name, "position", position)

	// Check if optimization is enabled and we're already in the correct position
	if config.Get().Shelly.GetOptimizeTilt() && s.Tilted && s.TiltPosition == position {
		logger.Info("Ignoring tilt command, already tilted correctly", s.Name, "current position", s.TiltPosition)
		return
	}

	wg := sync.WaitGroup{}

	logger.Debug("Setting position for tilt", s.Name, "target position", position)
	err := s.SetAndWaitForPosition(&wg, position, 60)
	if err != nil {
		logger.Error("Tilt failed; error setting position", s.Name, err)
		return
	}

	logger.Debug("Waiting for position to be reached", s.Name)
	wg.Wait()
	logger.Debug("Position reached, setting slat position", s.Name)

	// Wait between up and down for at least 500ms as specified in the motor documentation
	time.Sleep(500 * time.Millisecond)

	_, err = s.SetSlatPosition(s.Config.TiltPercentage)
	if err != nil {
		logger.Error("Tilt failed; error setting tilt position", s.Name, err)
		return
	}

	// Safely update tilt state
	s.mu.Lock()
	s.Tilted = true
	s.TiltPosition = position
	s.mu.Unlock()

	logger.Info("Tilt command completed successfully", s.Name, "position", position, "tilt percentage", s.Config.TiltPercentage)
}

func (s *ShadingActor) SlatOnly(position int) {
	logger.Info("Slat-only command started", s.Name, "slat position", position)

	if position != 0 {
		_, err := s.SetSlatPosition(0)
		if err != nil {
			logger.Error("Slat-only command failed", s.Name, err)
			return
		}
	}

	_, err := s.SetSlatPosition(position)
	if err != nil {
		logger.Error("Slat-only command failed", s.Name, err)
		return
	}

	// Update the slat position but don't change the tilt state
	s.mu.Lock()
	s.TiltPosition = position
	s.mu.Unlock()

	logger.Info("Slat-only command completed successfully", s.Name, "slat position", position)
}
