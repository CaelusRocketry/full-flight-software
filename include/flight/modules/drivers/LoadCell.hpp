#ifndef FLIGHT_LoadCell_HPP
#define FLIGHT_LoadCell_HPP

#include "HX711.h"

//This value is obtained using the SparkFun_HX711_Calibration sketch
#define calibration_factor -7050.0

HX711 scale;

class LoadCell {
private:
    float forceValue;

public:
    LoadCell(int DOUT, int CLK);

    void read();
    // The unit lbs, Newtons is based on how the sensor is configured
    float getForceValue();
};

#endif // FLIGHT_LoadCell_HPP