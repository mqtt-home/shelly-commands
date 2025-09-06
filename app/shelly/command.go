package shelly

import (
	"sync"

	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/config"
	"github.com/philipparndt/go-logger"
)

func (s *ShadingActor) Apply(command commands.LLCommand) {
	logger.Info("Applying command", s.Name, "action", command.Action, "position", command.Position)

	switch command.Action {
	case commands.LLActionSet:
		_, err := s.SetPosition(command.Position)
		if err != nil {
			logger.Error("Failed setting position", s.Name, err)
		} else {
			logger.Info("Set position command completed", s.Name, "position", command.Position)
		}
	case commands.LLActionTilt:
		s.Tilt(command.Position)
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
