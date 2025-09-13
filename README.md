# shelly-commands

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)

Convert the Shelly PM2 MQTT messages to support high level command for tilting compatible with:
https://github.com/mqtt-home/eltako-to-mqtt-gw

## Features

- **MQTT Integration**: Publish/subscribe to MQTT topics for home automation
- **Web Interface**: Modern React-based control panel for direct device management
- **REST API**: HTTP endpoints for integration with other systems
- **Tilt Control**: Advanced blind tilting with configurable positions

## Web Interface

The application now includes a built-in web interface accessible at `http://localhost:8080` when running.

### Features:
- **Dashboard**: View all actors and their current status
- **Individual Control**: Set position and tilt for each actor
- **Global Controls**: Tilt all actors simultaneously
- **Real-time Updates**: Status refreshes automatically
- **Responsive Design**: Works on desktop, tablet, and mobile

![Web Interface Screenshot](web-interface-screenshot.png)

### API Endpoints:
- `GET /api/actors` - List all actors
- `GET /api/actors/{name}` - Get specific actor status
- `POST /api/actors/{name}/position` - Set actor position
- `POST /api/actors/{name}/tilt` - Tilt specific actor
- `POST /api/actors/all/tilt` - Tilt all actors

## Devices

Currently, the `ESB62NP-IP/110-240V` is supported.

## Messages

### Position

Topic: `home/shelly/<device-name>`

```json
{
  "position": 0
}
```

### Set position

Topic: `home/shelly/<device-name>/set`

```json
{
  "position": 100
}
```

### Open the shading

Topic: `home/shelly/<device-name>/set`

```json
{
  "action": "open"
}
```

### Close the shading

Topic: `home/shelly/<device-name>/set`

```json
{
  "action": "close"
}
```

### Close and open the blinds

Topic: `home/shelly/<device-name>/set`

```json
{
  "action": "closeAndOpenBlinds"
}
```

This action will first close the blinds completely, then tilt them to the half open position. This is useful for resetting the tilt or ensuring the blinds are fully closed before tilting.

### Tilt the blinds

Topic: `home/shelly/<device-name>/set`

```json
{
  "action": "tilt",
  "position": 50
}
```

This will move the position to 50% and then tilt the blinds.

### Slat control (for blinds only)

Topic: `home/shelly/<device-name>/set`

```json
{
  "action": "slat",
  "position": 75
}
```

This will set the slat/tilt position directly without changing the main position of the blinds.

### Group commands

The application supports controlling multiple devices as a group. Group commands follow the same syntax as individual device commands but use a different topic structure.

Topic: `home/shelly/group:<group-id>/set`

All the same actions (open, close, tilt, etc.) are supported for groups. For example:

```json
{
  "action": "tilt",
  "position": 50
}
```

This will tilt all devices in the specified group to 50%.

## Status Messages

The application subscribes to Shelly device status updates and processes position changes automatically.

### Shelly device status (received)

Topic: `shelly/<topicBase>/status/cover:0`

The application automatically subscribes to this topic for each configured device to receive status updates from the Shelly device.

Example status message from Shelly device:
```json
{
  "id": 0,
  "source": "timer",
  "state": "stopped",
  "apower": 0.0,
  "voltage": 230.1,
  "current": 0.0,
  "pf": 0.0,
  "freq": 50.0,
  "aenergy": {
    "total": 123.456,
    "by_minute": [0.0, 0.0, 0.0],
    "minute_ts": 1234567890
  },
  "temperature": {
    "tC": 25.5,
    "tF": 77.9
  },
  "pos_control": true,
  "last_direction": "close",
  "current_pos": 50,
  "slat_pos": 25
}
```

Key fields used by the application:
- `current_pos`: Main position of the blinds/shutter (0-100, where 0=closed, 100=open)
- `slat_pos`: Tilt/slat position for blinds (0-100)

## MQTT Command Reference

### Individual Device Commands

All individual device commands use the topic pattern: `<mqtt.topic>/<device-name>/set`

| Action | Command | Description |
|--------|---------|-------------|
| **Open** | `{"action": "open"}` | Fully open the blinds/shutter (position 100) |
| **Close** | `{"action": "close"}` | Fully close the blinds/shutter (position 0) |
| **Set Position** | `{"position": 50}` or `{"action": "set", "position": 50}` | Move to specific position (0-100) |
| **Tilt** | `{"action": "tilt", "position": 50}` | Move to position and then tilt blinds |
| **Close and Open** | `{"action": "closeAndOpenBlinds"}` | Close completely, then tilt to half-open (useful for reset) |
| **Slat Only** | `{"action": "slat", "position": 75}` | Set slat/tilt position only (blinds only) |

### Group Commands

All group commands use the topic pattern: `<mqtt.topic>/group:<group-id>/set`

Group commands support all the same actions as individual device commands and will be applied to all devices in the specified group simultaneously.

Examples:
- `home/shelly/group:living-room/set` - Control all devices in "living-room" group
- `home/shelly/group:south-facing/set` - Control all devices in "south-facing" group

### Low-Level Shelly Commands (sent to device)

The application translates high-level commands into low-level Shelly device commands on the topic: `<topicBase>/command/cover:0`

| High-Level Action | Shelly Command | Description |
|------------------|----------------|-------------|
| Open (position 100) | `"open"` | Shelly native open command |
| Close (position 0) | `"close"` | Shelly native close command |
| Set Position | `"pos,<value>"` | Move to specific position (e.g., "pos,50") |
| Set Slat Position | `"slat_pos,<value>"` | Set slat position (e.g., "slat_pos,75") |
| Status Update | `"status_update"` | Request current status from device |

## Configuration

You can configure devices either by specifying their IP address directly or by using their serial number. If you use the serial number, the IP address will be discovered automatically using Zeroconf (mDNS/Bonjour).

### Example configuration
```json
{
  "mqtt": {
    "url": "tcp://192.168.0.1:1883",
    "retain": true,
    "topic": "home/shelly",
    "qos": 2
  },
  "shelly": {
    "devices": [
      {
        "name": "dining-room-right",
        "topicBase": "shelly/eg/esszimmer/rechts",
        "blindsConfig": {
          "TiltPercentage": 40
        }
      }
    ]
  },
  "loglevel": "trace"
}
```

## Developer Documentation

### Build

To build the project with web interface:

```sh
cd app
make build
```

This will build both the React frontend and Go backend.

### Run

To run the gateway with web interface:

```sh
cd app
make run
```

The web interface will be available at http://localhost:8080

### Development

For development with hot-reload:

```sh
cd app
./dev.sh
```

This starts:
- Backend API server on http://localhost:8080
- Frontend dev server on http://localhost:5173 (with hot reload)

### Docker

To build and run the Docker image with web interface:

```sh
cd app
make docker
docker run -p 8080:8080 -v /path/to/config:/var/lib/eltako-to-mqtt-gw pharndt/eltako:latest
```

Or use the development docker-compose:

```sh
cd app
docker-compose -f docker-compose.dev.yml up --build
```

### Create a Release

Releases are created by tagging a commit in git. We use [goreleaser](https://goreleaser.com/) to build and publish release artifacts automatically.

1. Make sure all changes are committed and pushed to the main branch.
2. Create a new git tag for the release:
   ```sh
   git tag vX.Y.Z
   git push --tags
   ```
3. GitHub Actions (or your CI) will run goreleaser to build and publish the release artifacts automatically.
4. Optionally, create a release on GitHub and add release notes.
