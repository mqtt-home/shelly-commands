package shelly

import (
	"sync"
	"time"

	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/config"
	"github.com/philipparndt/go-logger"
)

func (s *ShadingActor) Apply(command commands.LLCommand) {
	logger.Info("Applying command", "actor", s.Name, "action", command.Action, "position", command.Position, "device_type", s.DeviceType)

	switch command.Action {
	case commands.LLActionSet:
		_, err := s.SetPosition(command.Position)
		if err != nil {
			logger.Error("Failed setting position", "actor", s.Name, "error", err)
		} else {
			logger.Info("Set position command completed", "actor", s.Name, "position", command.Position)
		}
	case commands.LLActionTilt:
		if s.IsRollerShutter() {
			s.TiltRollerShutter()
		} else {
			s.Tilt(command.Position)
		}
	case commands.LLActionSlat:
		if s.IsRollerShutter() {
			logger.Info("Ignoring slat command for roller shutter", "actor", s.Name)
			return
		}
		s.SlatOnly(command.Position)
	}

	logger.Debug("Command application finished", "actor", s.Name, "action", command.Action)
}

func (s *ShadingActor) Tilt(position int) {
	logger.Info("Tilt command started", "actor", s.Name, "position", position)

	// Check if optimization is enabled and we're already in the correct position
	if config.Get().Shelly.GetOptimizeTilt() && s.Tilted && s.TiltPosition == position {
		logger.Info("Ignoring tilt command, already tilted correctly", "actor", s.Name, "current_position", s.TiltPosition)
		return
	}

	wg := sync.WaitGroup{}

	logger.Debug("Setting position for tilt", "actor", s.Name, "target_position", position)
	err := s.SetAndWaitForPosition(&wg, position, 60)
	if err != nil {
		logger.Error("Tilt failed; error setting position", "actor", s.Name, "error", err)
		return
	}

	logger.Debug("Waiting for position to be reached", "actor", s.Name)
	wg.Wait()
	logger.Debug("Position reached, setting slat position", "actor", s.Name)

	// Wait between up and down for at least 500ms as specified in the motor documentation
	time.Sleep(500 * time.Millisecond)

	_, err = s.SetSlatPosition(s.Config.TiltPercentage)
	if err != nil {
		logger.Error("Tilt failed; error setting tilt position", "actor", s.Name, "error", err)
		return
	}

	// Safely update tilt state
	s.mu.Lock()
	s.Tilted = true
	s.TiltPosition = position
	s.mu.Unlock()

	logger.Info("Tilt command completed successfully", "actor", s.Name, "position", position, "tilt_percentage", s.Config.TiltPercentage)
}

func (s *ShadingActor) TiltRollerShutter() {
	tiltPos := s.Config.TiltPosition
	logger.Info("Tilt roller shutter command started", "actor", s.Name, "target_position", tiltPos)

	// Check if optimization is enabled and we're already in the correct position
	if config.Get().Shelly.GetOptimizeTilt() && s.Tilted && s.Position == tiltPos {
		logger.Info("Ignoring tilt command, already at tilt position", "actor", s.Name, "current_position", s.Position)
		return
	}

	_, err := s.SetPosition(tiltPos)
	if err != nil {
		logger.Error("Tilt roller shutter failed", "actor", s.Name, "error", err)
		return
	}

	s.mu.Lock()
	s.Tilted = true
	s.TiltPosition = tiltPos
	s.mu.Unlock()

	logger.Info("Tilt roller shutter command completed", "actor", s.Name, "position", tiltPos)
}

func (s *ShadingActor) SlatOnly(position int) {
	logger.Info("Slat-only command started", "actor", s.Name, "slat_position", position)

	if position != 0 {
		_, err := s.SetSlatPosition(0)
		if err != nil {
			logger.Error("Slat-only command failed", "actor", s.Name, "error", err)
			return
		}
	}

	_, err := s.SetSlatPosition(position)
	if err != nil {
		logger.Error("Slat-only command failed", "actor", s.Name, "error", err)
		return
	}

	// Update the slat position but don't change the tilt state
	s.mu.Lock()
	s.TiltPosition = position
	s.mu.Unlock()

	logger.Info("Slat-only command completed successfully", "actor", s.Name, "slat_position", position)
}
