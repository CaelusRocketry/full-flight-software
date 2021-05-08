#ifndef FLIGHT_VALVEDRIVER_HPP
#define FLIGHT_VALVEDRIVER_HPP

#include <vector>
#include <flight/modules/lib/Enums.hpp>

using namespace std;

class ValveDriver {
private:
    vector<int> valve_pins;
    vector<SolenoidState> valve_states;
    vector<ActuationType> valve_actuations;
    int NUM_VALVES = 0;

    void writeVal(int pin, int signal);
    int getIndex(int pin);
    void openVent(int pin);
    void closeVent(int pin);
    // void handlePulsing();
    // void handleSpecial();

public:
    ValveDriver(vector<int> pins);
    SolenoidState getSolenoidState(int pin);
    ActuationType getActuationType(int pin);
    void actuate(int pin, ActuationType actuation_type);
};

#endif // FLIGHT_VALVEDRIVER_HPP