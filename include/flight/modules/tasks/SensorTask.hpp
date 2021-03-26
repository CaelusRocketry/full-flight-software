#ifndef FLIGHT_SENSORARDUINO_HPP
#define FLIGHT_SENSORARDUINO_HPP

#include <vector>
#include <tuple>
#include <flight/modules/drivers/Arduino.hpp>
#include <flight/modules/drivers/PressureDriver.hpp>
#include <flight/modules/tasks/Task.hpp>

class SensorTask : public Task {
private:
    Arduino* sensor;
    PressureDriver* pressure_driver;
    // Defined here because eventually we'll use dynamic memory allocation to figure out how many sensors are there.
    // This is a temporary fix, eventually you wont need the const modifier, and you won't initialize it to some arbitrary value
    const static int NUM_SENSORS = 4;
    vector<pair<string, string>> sensor_list;
    unordered_map<int, pair<string, string>> pin_sensor_mappings;
    vector<int> pressure_pins;
    
public:
    SensorTask() = default;
    void initialize() override;
    void read() override;
    void actuate() override;
};


#endif //FLIGHT_SENSORARDUINO_HPP
