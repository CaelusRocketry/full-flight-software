#ifndef DESKTOP

    #ifndef FLIGHT_LOADCELLDRIVER_HPP
    #define FLIGHT_LOADCELLDRIVER_HPP

    #include <flight/modules/lib/Enums.hpp>
    #include <flight/modules/lib/Util.hpp>

    #include <vector>
    #include <HX711.h>

    // THESE VALUES ARE NOT CORRECT, please confirm with someone on propulsion
    #define calibration_factor -7050.0 //This value is obtained using the SparkFun_HX711_Calibration sketch

    using namespace std;

    class LoadCellDriver {
    private:
        vector<int> load_cell_pins;
        vector<float> force_vals;
        vector<HX711*> load_cells;

        float readSensor(int pin);
    
    public:
        LoadCellDriver(vector<vector<int>> pins);
        void read();
        float getForceValue(int pin);
    };

    #endif // FLIGHT_LOADCELLDRIVER_HPP

#endif // DESKTOP