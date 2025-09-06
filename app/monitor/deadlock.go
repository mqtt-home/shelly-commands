package monitor

import (
	"context"
	"runtime"
	"time"

	"github.com/philipparndt/go-logger"
)

// DeadlockMonitor monitors for potential deadlocks by tracking goroutine counts
type DeadlockMonitor struct {
	ctx                context.Context
	cancel             context.CancelFunc
	lastGoroutines     int
	stuckCount         int
	checkInterval      time.Duration
	stuckThreshold     int
	goroutineThreshold int
}

// NewDeadlockMonitor creates a new deadlock monitor
func NewDeadlockMonitor(checkInterval time.Duration, stuckThreshold int, goroutineThreshold int) *DeadlockMonitor {
	ctx, cancel := context.WithCancel(context.Background())
	return &DeadlockMonitor{
		ctx:                ctx,
		cancel:             cancel,
		checkInterval:      checkInterval,
		stuckThreshold:     stuckThreshold,
		goroutineThreshold: goroutineThreshold,
	}
}

// Start begins monitoring for deadlocks
func (dm *DeadlockMonitor) Start() {
	go dm.monitor()
}

// Stop stops the deadlock monitor
func (dm *DeadlockMonitor) Stop() {
	dm.cancel()
}

func (dm *DeadlockMonitor) monitor() {
	ticker := time.NewTicker(dm.checkInterval)
	defer ticker.Stop()

	logger.Info("Deadlock monitor started", "check_interval", dm.checkInterval, "stuck_threshold", dm.stuckThreshold)

	for {
		select {
		case <-dm.ctx.Done():
			logger.Info("Deadlock monitor stopped")
			return
		case <-ticker.C:
			dm.checkGoroutines()
		}
	}
}

func (dm *DeadlockMonitor) checkGoroutines() {
	currentGoroutines := runtime.NumGoroutine()

	if currentGoroutines > dm.goroutineThreshold {
		logger.Warn("High goroutine count detected", "count", currentGoroutines, "threshold", dm.goroutineThreshold)
	}

	if currentGoroutines == dm.lastGoroutines {
		dm.stuckCount++
		if dm.stuckCount >= dm.stuckThreshold {
			logger.Error("Potential deadlock detected", "goroutines", currentGoroutines, "stuck_checks", dm.stuckCount)
			dm.logGoroutineStack()
		}
	} else {
		if dm.stuckCount > 0 {
			logger.Debug("Goroutine count changed, resetting stuck counter", "old", dm.lastGoroutines, "new", currentGoroutines)
		}
		dm.stuckCount = 0
	}

	dm.lastGoroutines = currentGoroutines
	logger.Debug("Goroutine check", "count", currentGoroutines, "stuck_count", dm.stuckCount)
}

func (dm *DeadlockMonitor) logGoroutineStack() {
	buf := make([]byte, 1024*1024)
	stackSize := runtime.Stack(buf, true)
	logger.Error("Goroutine stack dump", "stack", string(buf[:stackSize]))
}
