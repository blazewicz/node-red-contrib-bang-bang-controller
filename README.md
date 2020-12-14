# Node-RED Bang-Bang Controller Node

Bang-bang controller (2 step controller, on-off controller, hysteresis controller) is a feedback controller that switches between two states. [1]

Node sends one of two programmed output values on state change.

State changes from `low` to `high` when received `payload` value is greater than Threshold Upper.
Similarly, transition from `high` to `low` occurs when `payload` value is less than Threshold Lower.

Primary intended use of this block is a [thermostat](https://en.wikipedia.org/wiki/Thermostat).

[1]: https://en.wikipedia.org/wiki/Bang%E2%80%93bang_control
