#include <flight/modules/lib/logger_util.hpp>
#include <flight/modules/tasks/SensorTask.hpp>
#include <flight/modules/mcl/Config.hpp>

void SensorTask::initialize() {
    // Generates the sensor list
    /* Pair of <string, <string, sensorinfo>> */
    for (const auto& type_ : global_config.sensors.list) {
        /* Pair of <string, sensorinfo> */
        for (const auto& location_ : type_.second) {
            sensor_list.push_back(make_pair(type_.first, location_.first));
            int pin = location_.second.pin;
            pin_sensor_mappings[pin] = make_pair(type_.first, location_.first);
            pressure_pins.push_back(pin);
        }
    }

    pressure_driver = new PressureDriver(pressure_pins);
    print("Sensor: Initialized");
}

void SensorTask::read() {
    print("Sensor: Reading");
    pressure_driver->read(); // data returned as an array of chars

    // Update pressure sensor values
    for(unsigned int i = 0; i < pressure_pins.size(); i++){
        int pin = pressure_pins[i];
        pair<string, string> sensor_info = pin_sensor_mappings[pin];
        string type = sensor_info.first;
        // specific sensor, pressure sensor 1, pressure sensor 2, etc.
        string loc = sensor_info.second;
        float value = pressure_driver->getPressureValue(pin);
        global_registry.sensors[type][loc].measured_value = value;
    }

}

void SensorTask::actuate() {}