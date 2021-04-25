#ifndef DESKTOP
    #include <flight/modules/drivers/LoadCellDriver.hpp>
    #include "Arduino.h"
    #include <HX711.h>

    LoadCellDriver::LoadCellDriver(vector<vector<int>> pins){

        for(unsigned int i = 0; i < pins.size(); i++){
            load_cell_pins.push_back(pins[i][0]);
            force_vals.push_back(1010);

            HX711 *scale = new HX711();
            scale->begin(pins[i][0], pins[i][1]);
            scale->set_scale(calibration_factor);
            scale->tare();     //Assuming there is no weight on the scale at start up, reset the scale to 0
            load_cells.push_back(scale);
        }
    }

    void LoadCellDriver::read(){
        for(unsigned int i = 0; i < load_cell_pins.size(); i++){
            force_vals[i] = readSensor(load_cell_pins[i]);
        }    
    }

    float LoadCellDriver::getForceValue(int pin){
        int idx = -1;
        for(unsigned int i = 0; i < load_cell_pins.size(); i++){
            if(force_vals[i] == pin){
                idx = i;
                break;
            }
        }
        if(idx == -1){
            return 0.0;
        }
        return force_vals[idx];    
    }

    float LoadCellDriver::readSensor(int pin){
        int idx = Util::getIndex<int>(load_cell_pins, pin);
        float ret = 0.0;
        ret = this->load_cells[idx]->get_units();
        // print(Util::to_string(idx) + " " + Util::to_string(ret) );
        return ret;
    }

#endif  // DESKTOP
