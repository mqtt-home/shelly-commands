# Deadlock Investigation and Prevention

## Summary of Potential Deadlock Issues Fixed

This document outlines the deadlock issues that were identified and fixed in the Shelly Commands application.

## Issues Identified

### 1. Blocking Channel Writes in MQTT Callbacks
**Location**: `app/shelly/shelly.go` - Line 68
**Problem**: The MQTT status callback was writing to `PositionChangeChan` with a blocking send. If the web server's SSE handler wasn't reading from this channel fast enough, it could block the MQTT callback goroutine, preventing further MQTT message processing.

**Fix**: Changed to non-blocking channel send with logging:
```go
select {
case PositionChangeChan <- event:
    logger.Debug("Position change event sent", s.Name, status.CurrentPos)
default:
    logger.Warn("Position change channel is full, dropping event", s.Name, status.CurrentPos)
}
```

### 2. Race Conditions in Actor State Access
**Location**: `app/shelly/shelly.go` and `app/shelly/position.go`
**Problem**: Multiple goroutines were accessing actor state (Position, TiltPosition, Tilted) without proper synchronization.

**Fix**: Added mutex protection around all state access:
```go
s.mu.Lock()
s.Position = status.CurrentPos
s.TiltPosition = status.SlatPos
s.Tilted = status.SlatPos != 0
s.mu.Unlock()
```

### 3. Unsynchronized Actor Registry Access
**Location**: `app/shelly/registry.go`
**Problem**: The actor registry was accessed concurrently without synchronization, potentially causing race conditions.

**Fix**: Added RWMutex to protect all registry operations:
```go
type ActorRegistry struct {
    Actors map[string]*ShadingActor
    mu     sync.RWMutex
}
```

### 4. Error Handling in SSE Connections
**Location**: `app/web/web.go`
**Problem**: SSE connections weren't properly handling write errors, which could cause goroutine leaks.

**Fix**: Added proper error handling and early returns on write failures.

## New Monitoring Features

### Deadlock Monitor
A new deadlock monitoring system has been added (`app/monitor/deadlock.go`) that:
- Monitors goroutine count changes
- Detects when goroutine counts remain constant for extended periods
- Logs goroutine stack dumps when potential deadlocks are detected
- Configurable thresholds and check intervals

### Enhanced Logging
Comprehensive logging has been added throughout the application:
- MQTT message processing
- Actor state changes
- Position waiting and timeouts
- Command processing flow
- SSE connection management
- Goroutine lifecycle tracking

## Debugging Commands

To help debug issues in production:

### Check goroutine count
```bash
# If running in a container with debug endpoints
curl http://localhost:8080/debug/pprof/goroutine?debug=1
```

### Monitor logs for deadlock indicators
Look for these log messages:
- `Position change channel is full, dropping event` - Channel backpressure
- `Potential deadlock detected` - Deadlock monitor alert
- `High goroutine count detected` - Possible goroutine leak
- `Timeout waiting for position` - Actor position timeouts

## Configuration Recommendations

### Log Level
For production debugging, consider setting log level to `DEBUG` temporarily:
```json
{
  "logLevel": "DEBUG"
}
```

### Monitor Settings
The deadlock monitor is configured with:
- Check interval: 30 seconds
- Stuck threshold: 4 consecutive stable checks (2 minutes)
- Goroutine threshold: 50 goroutines

## Testing the Fixes

### Scenario 1: High MQTT Traffic
1. Send rapid MQTT commands to multiple actors
2. Monitor logs for channel backpressure warnings
3. Verify commands are still processed

### Scenario 2: Position Timeout
1. Send position command to unreachable device
2. Verify timeout occurs and goroutine cleans up
3. Check that other actors remain responsive

### Scenario 3: SSE Client Overload
1. Connect multiple SSE clients
2. Generate position change events
3. Verify no blocking occurs in MQTT processing

## Recovery Procedures

If deadlocks still occur:

1. **Immediate**: Restart the application
2. **Investigation**: Check logs for deadlock monitor alerts
3. **Analysis**: Look for goroutine stack dumps in logs
4. **Monitoring**: Enable DEBUG logging to trace execution flow

## Prevention Best Practices

1. **Always use non-blocking channel operations** in MQTT callbacks
2. **Protect shared state** with appropriate synchronization primitives
3. **Set timeouts** for all blocking operations
4. **Monitor goroutine counts** in production
5. **Use structured logging** to trace execution flow
