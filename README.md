[![platform](https://img.shields.io/badge/platform-Node--RED-red)](https://nodered.org)
[![npm](https://img.shields.io/npm/v/node-red-contrib-qsys.svg)](https://www.npmjs.com/package/node-red-contrib-qsys)
![license](https://img.shields.io/npm/l/node-red-contrib-qsys.svg)
[![Npm package total downloads](https://badgen.net/npm/dt/node-red-contrib-qsys)](https://www.npmjs.com/package/node-red-contrib-qsys)
[![github-issues](https://img.shields.io/github/issues/dudest/node-red-contrib-qsys.svg)](https://github.com/dudest/node-red-contrib-qsys/issues)

# node-red-contrib-qsys

A collection of nodes for controlling Q-Sys.

![screenshot](images/screenshot_01.png)

---

## Release Notes

| Version | Description |
|---------|-------------------------------|
| 1.0.2   | Updated dependencies          |
| 1.0.1   | Maintenance and documentation |
| 1.0.0   | initial release               |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) v12.13.0 or newer
- [Node-RED](https://nodered.org) v3.0.1 or newer

*untested on earlier versions*

### Installation

Install via Node-RED Manage Palette

`node-red-contrib-qsys`

Install via npm

```
$ cd ~/.node-red
$ npm install node-red-contrib-qsys
# then restart node-red
```

## Nodes

### qsys-core (config node)

Manages connection to the Q-Sys Core.

![qsys-core edit dialog](images/edit_qsys-core.png)

### qsys-ControlSet

To be used with named controls. Auto subscribes to a change group when deployed.

![qsys-ControlSet edit dialog](images/edit_qsys-ControlSet.png)

### qsys-Control-Preset

![qsys-Presets edit dialog](images/edit_qsys-Preset.png)

## Resources

- [Q-Sys website](https://www.qsys.com/)
- [QRC Commands](https://q-syshelp.qsc.com/Content/External_Control_APIs/QRC/QRC_Commands.htm)

## Feature Requests / Bug Reporting

Please report any bugs or issues to the repository [here](https://github.com/dudest/node-red-contrib-qsys/issues).

## Task List

- [ ] Lab test redundant core logic
