package shelly

import (
	"sync"

	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/config"
	"github.com/philipparndt/go-logger"
)

func (s *ShadingActor) Apply(command commands.LLCommand) {

	switch command.Action {
	case commands.LLActionSet:
		_, err := s.SetPosition(command.Position)
		if err != nil {
			logger.Error("Failed setting position", err)
		} else {
			logger.Info("Set position to", command.Position)
		}
	case commands.LLActionTilt:
		s.Tilt(command.Position)
	}
}

func (s *ShadingActor) Tilt(position int) {
	logger.Debug("Tilt command received", s, "to position", position)
	if config.Get().Shelly.GetOptimizeTilt() && s.Tilted && s.TiltPosition == position {
		logger.Debug("Ignoring tilt command, already tilted correctly", s)
		return
	}

	wg := sync.WaitGroup{}

	err := s.SetAndWaitForPosition(&wg, position, 60)
	if err != nil {
		logger.Error("Tilt failed; error setting position", s, err)
		return
	}
	wg.Wait()

	_, err = s.SetSlatPosition(s.Config.TiltPercentage)
	if err != nil {
		logger.Error("Tilt failed; error setting tilt position", s, err)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.Tilted = true
	s.TiltPosition = position
	logger.Debug("Tilt command executed successfully", s, "to position", position)
}
