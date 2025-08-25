package web

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/philipparndt/go-logger"
)

// LogEntry interface compatible with chi middleware.LogEntry
// This allows us to avoid importing chi middleware package
type LogEntry interface {
	Write(status, bytes int, header http.Header, elapsed time.Duration, extra interface{})
	Panic(v interface{}, stack []byte)
}

// LogFormatter interface compatible with chi middleware.LogFormatter
// This allows us to avoid importing chi middleware package
type LogFormatter interface {
	NewLogEntry(r *http.Request) LogEntry
}

// CustomLogFormatter implements the LogFormatter interface
// and uses the custom go-logger for output
type CustomLogFormatter struct{}

// NewLogEntry creates a new LogEntry for the request using our custom logger
func (f *CustomLogFormatter) NewLogEntry(r *http.Request) LogEntry {
	return &CustomLogEntry{
		request: r,
	}
}

type CustomLogEntry struct {
	request *http.Request
}

func (l *CustomLogEntry) Write(status, bytes int, header http.Header, elapsed time.Duration, extra interface{}) {
	// Format the log message similar to the default chi logger but using our custom logger
	scheme := "http"
	if l.request.TLS != nil {
		scheme = "https"
	}

	// Build the log message
	message := fmt.Sprintf("\"%s %s://%s%s %s\" %d %dB in %s from %s",
		l.request.Method,
		scheme,
		l.request.Host,
		l.request.RequestURI,
		l.request.Proto,
		status,
		bytes,
		elapsed,
		l.request.RemoteAddr,
	)

	// Use our custom logger based on status code
	switch {
	case status >= 500:
		logger.Error(message)
	case status >= 400:
		logger.Warn(message)
	default:
		logger.Debug(message)
	}
}

func (l *CustomLogEntry) Panic(v interface{}, stack []byte) {
	logger.Panic("Request panic", v, string(stack))
}

// ChiLogFormatterAdapter adapts our chi-independent LogFormatter to chi's middleware.LogFormatter
type ChiLogFormatterAdapter struct {
	formatter LogFormatter
}

func (a *ChiLogFormatterAdapter) NewLogEntry(r *http.Request) middleware.LogEntry {
	entry := a.formatter.NewLogEntry(r)
	return &ChiLogEntryAdapter{entry: entry}
}

// ChiLogEntryAdapter adapts our chi-independent LogEntry to chi's middleware.LogEntry
type ChiLogEntryAdapter struct {
	entry LogEntry
}

func (a *ChiLogEntryAdapter) Write(status, bytes int, header http.Header, elapsed time.Duration, extra interface{}) {
	a.entry.Write(status, bytes, header, elapsed, extra)
}

func (a *ChiLogEntryAdapter) Panic(v interface{}, stack []byte) {
	a.entry.Panic(v, stack)
}

func ChiLogger() func(next http.Handler) http.Handler {
	formatter := &CustomLogFormatter{}
	adapter := &ChiLogFormatterAdapter{formatter: formatter}
	return middleware.RequestLogger(adapter)
}
