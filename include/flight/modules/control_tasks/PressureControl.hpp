#ifndef FLIGHT_PRESSURECONTROL_HPP
#define FLIGHT_PRESSURECONTROL_HPP

#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/lib/Log.hpp>
#include <flight/modules/lib/Enums.hpp>
#include <unordered_map>
#include "StageControl.hpp"

class PressureControl : public Control {
private:

    vector<basic_string<char>> activate_stages;
    map<basic_string<char>, ConfigValveInfo> valves;
    map<basic_string<char>, ConfigSensorInfo> sensors;
    vector<pair<SensorLocation, ValveLocation>> matchups;

    void check_pressure();

public:
    PressureControl();
    void begin();
    void execute();

    void begin(json &config);
};
#endif //FLIGHT_PRESSURECONTROL_HPP
