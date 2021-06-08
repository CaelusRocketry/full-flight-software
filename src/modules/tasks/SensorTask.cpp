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

            int pin;
            if(type_.first == "pressure") {
                pin = location_.second.pressure_pin;
                pressure_pins.push_back(pin);
            }
            if (type_.first == "thermocouple")
            {
                pin = location_.second.thermo_pins[0];
                thermo_pins.push_back( location_.second.thermo_pins );
            }
            if (type_.first == "load_cell")
            {
                pin = location_.second.load_cell_pins[0];
                load_cell_pins.push_back( location_.second.load_cell_pins );
            }


            pin_sensor_mappings[pin] = make_pair(type_.first, location_.first);
        }
    }

    #ifdef DESKTOP
        pressure_driver = new PseudoPressureDriver(pressure_pins);
        thermo_driver = new PseudoThermoDriver(thermo_pins);
    #else
        pressure_driver = new PressureDriver(pressure_pins);
        thermo_driver = new ThermoDriver(thermo_pins);
        load_cell_driver = new LoadCellDriver(load_cell_pins);
    #endif

    print("Sensor: Initialized");
}

void SensorTask::read() {
    print("Sensor: Reading");
    pressure_driver->read();
    thermo_driver->read();

    // Update pressure sensor values
    for(unsigned int i = 0; i < pressure_pins.size(); i++){
        int pin = pressure_pins[i];
        pair<string, string> sensor_info = pin_sensor_mappings[pin];
        string type = sensor_info.first;
        // specific sensor, pressure sensor 1, pressure sensor 2, etc.
        string loc = sensor_info.second;

        
        float value = global_config.sensors.list[type][loc].slope * pressure_driver->getPressureValue(pin) - global_config.sensors.list[type][loc].bias;
        print(type + " " + loc + ": " + Util::to_string((double) value));
        global_registry.sensors[type][loc].measured_value = value;
    }

    // Update thermo sensor values
    for(unsigned int i = 0; i < thermo_pins.size(); i++){
        int pin = thermo_pins[i][0];                
        pair<string, string> sensor_info = pin_sensor_mappings[pin];
        string type = sensor_info.first;
        // specific sensor, pressure sensor 1, pressure sensor 2, etc.
        string loc = sensor_info.second;
        float value = thermo_driver->getThermoValue(pin);
        // print(type + " " + loc + ": " + Util::hex((double) value));
        global_registry.sensors[type][loc].measured_value = value;
    }

}

void SensorTask::actuate() {}