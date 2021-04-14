#ifndef DESKTOP
    #include <flight/modules/drivers/LoadCell.hpp>
    #include "Arduino.h"

    LoadCell::LoadCell(int DOUT, int CLK){
        scale.begin(DOUT, CLK);
        scale.set_scale(calibration_factor);

        //Assuming there is no weight on the scale at start up, reset the scale to 0
        scale.tare();
    }

    void LoadCell::read(){
        forceValue = scale.get_units();
    }

    float LoadCell::getForceValue(){
        return forceValue;
    }

#endif
