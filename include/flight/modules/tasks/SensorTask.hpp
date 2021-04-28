#ifndef FLIGHT_SENSORARDUINO_HPP
#define FLIGHT_SENSORARDUINO_HPP

#include <vector>
#include <tuple>
#include <flight/modules/tasks/Task.hpp>
#ifdef DESKTOP
    #include <flight/modules/drivers/PseudoPressureDriver.hpp>
    #include <flight/modules/drivers/PseudoThermoDriver.hpp>
    #include <flight/modules/drivers/PseudoLoadCellDriver.hpp>

#else
    #include <flight/modules/drivers/PressureDriver.hpp>
    #include <flight/modules/drivers/ThermoDriver.hpp>
    #include <flight/modules/drivers/LoadCellDriver.hpp>
#endif

class SensorTask : public Task {
private:
    #ifdef DESKTOP
        PseudoPressureDriver* pressure_driver;
        PseudoThermoDriver* thermo_driver;
        PseudoLoadCellDriver* load_cell_driver;
    #else
        PressureDriver* pressure_driver;
        ThermoDriver* thermo_driver;
        LoadCellDriver* load_cell_driver;
    #endif
    
    // Defined here because eventually we'll use dynamic memory allocation to figure out how many sensors are there.
    // This is a temporary fix, eventually you wont need the const modifier, and you won't initialize it to some arbitrary value
    // const static int NUM_SENSORS = 4;
    vector<pair<string, string>> sensor_list;
    unordered_map<int, pair<string, string>> pin_sensor_mappings;
    vector<int> pressure_pins;
    vector<vector<int>> thermo_pins;
    vector<vector<int>> load_cell_pins;
    
public:
    SensorTask() = default;
    void initialize() override;
    void read() override;
    void actuate() override;
};


#endif //FLIGHT_SENSORARDUINO_HPP
