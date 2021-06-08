#ifndef FLIGHT_VALVEDRIVER_HPP
#define FLIGHT_VALVEDRIVER_HPP

#include <vector>
#include <flight/modules/lib/Enums.hpp>
#include <flight/modules/mcl/Config.hpp>

using namespace std;

class ValveDriver {
private:
    vector<int> valve_pins;
    vector<SolenoidState> valve_states;
    vector<ActuationType> valve_actuations;
    vector<long double> time_starts;
    vector<bool> valve_is_nc;
    vector<bool> is_specialing;
    int NUM_VALVES = 0;

    void writeVal(int pin, int signal);
    int getIndex(int pin);
    void openVent(int pin);
    void closeVent(int pin);
    void handlePulsing();
    void handleSpecial();

public:
    ValveDriver(vector<ConfigValveInfo> valve_infos);
    SolenoidState getSolenoidState(int pin);
    ActuationType getActuationType(int pin);
    void actuate(int pin, ActuationType actuation_type);
    void control();
};

#endif // FLIGHT_VALVEDRIVER_HPP