package main

import (
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"

	"github.com/mqtt-home/shelly-commands/commands"
	"github.com/mqtt-home/shelly-commands/config"
	"github.com/mqtt-home/shelly-commands/shelly"
	"github.com/mqtt-home/shelly-commands/version"
	"github.com/mqtt-home/shelly-commands/web"
	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/mqtt"
)

func startActors(cfg config.Shelly) {
	wg := &sync.WaitGroup{}
	for _, device := range cfg.Devices {
		startActor(&device, wg)
	}
	wg.Wait()
}

func startActor(device *config.Device, wg *sync.WaitGroup) *shelly.ShadingActor {
	logger.Info(fmt.Sprintf("Initializing actor: %s", device.Name), device.TopicBase)
	actor := shelly.NewShadingActor(*device)
	err := actor.Start()
	if err != nil {
		panic(err)
	}
	registry.AddActor(actor)
	return actor
}

func subscribeToCommands(cfg config.Config, actors *shelly.ActorRegistry) {
	prefix := cfg.MQTT.Topic + "/"
	postfix := "/set"
	mqtt.Subscribe(prefix+"+"+postfix, func(topic string, payload []byte) {
		logger.Debug("Received message", topic, string(payload))
		actor := actors.GetActor(topic[len(prefix) : len(topic)-len(postfix)])
		if actor == nil {
			logger.Error("Unknown actor:", topic)
			return
		}

		command, err := commands.Parse(payload)
		if err != nil {
			logger.Error("Failed to parse command", err)
			return
		}
		go actor.Apply(command)
	})
}

var registry = shelly.NewActorRegistry()

func main() {
	logger.Info("Shelly Commands", version.Info())
	
	if len(os.Args) < 2 {
		logger.Error("No configuration file specified")
		os.Exit(1)
	}

	configFile := os.Args[1]
	logger.Info("Configuration file:", configFile)
	err := error(nil)

	cfg, err := config.LoadConfig(configFile)
	if err != nil {
		logger.Error("Failed to load configuration", err)
		return
	}

	logger.SetLevel(cfg.LogLevel)

	mqtt.Start(cfg.MQTT, "shelly_mqtt")

	startActors(cfg.Shelly)
	subscribeToCommands(cfg, registry)

	// Start web server
	if !cfg.Web.Enabled {
		logger.Info("Web interface is disabled in the configuration")
	} else {
		logger.Info("Web interface enabled, starting web server")
		webServer := web.NewWebServer(registry)
		go func() {
			err := webServer.Start(cfg.Web.Port)
			if err != nil {
				logger.Error("Failed to start web server", err)
			}
		}()
		logger.Info("Application is now ready. Web interface available at http://localhost:" + strconv.Itoa(cfg.Web.Port) + ". Press Ctrl+C to quit.")
	}

	quitChannel := make(chan os.Signal, 1)
	signal.Notify(quitChannel, syscall.SIGINT, syscall.SIGTERM)
	<-quitChannel

	logger.Info("Received quit signal")
}
