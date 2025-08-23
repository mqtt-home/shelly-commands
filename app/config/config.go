package config

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/philipparndt/go-logger"
	"github.com/philipparndt/mqtt-gateway/config"
)

var cfg Config

type Config struct {
	MQTT     config.MQTTConfig `json:"mqtt"`
	Shelly   Shelly            `json:"shelly"`
	Web      WebConfig         `json:"web"`
	LogLevel string            `json:"loglevel,omitempty"`
}

type WebConfig struct {
	Enabled bool `json:"enabled"`
	Port    int  `json:"port"`
}

type BlindsConfig struct {
	TiltPercentage int `json:"tiltPercentage"`
}

type Device struct {
	Name         string       `json:"name"`
	TopicBase    string       `json:"topicBase"`
	BlindsConfig BlindsConfig `json:"blindsConfig"`
}

func (d *Device) String() string {
	return fmt.Sprintf("Device{name: %s; base: %s}", d.Name, d.TopicBase)
}

type Shelly struct {
	Devices         []Device `json:"devices"`
	PollingInterval int      `json:"polling-interval"`
	OptimizeTilt    *bool    `json:"optimizeTilt,omitempty"`
}

func LoadConfig(file string) (Config, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		logger.Error("Error reading config file", err)
		return Config{}, err
	}

	data = config.ReplaceEnvVariables(data)

	// Unmarshal the JSON data into the Config object
	err = json.Unmarshal(data, &cfg)
	if err != nil {
		logger.Error("Unmarshaling JSON:", err)
		return Config{}, err
	}

	// Set default values
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}

	// Set default value for OptimizeTilt if not specified in config
	if cfg.Shelly.OptimizeTilt == nil {
		defaultOptimizeTilt := true
		cfg.Shelly.OptimizeTilt = &defaultOptimizeTilt
	}

	return cfg, nil
}

//
//func (c *Shelly) GetBySN(sn string) *Device {
//	for i := range c.Devices {
//		if c.Devices[i].Serial == sn {
//			return &c.Devices[i]
//		}
//	}
//
//	return nil
//}

func (e Shelly) GetOptimizeTilt() bool {
	if e.OptimizeTilt == nil {
		return true // default value
	}
	return *e.OptimizeTilt
}

func Get() Config {
	return cfg
}
