//
// Created by Srikar on 4/15/2020.
//

#ifndef FLIGHT_ABORTCONTROL_HPP
#define FLIGHT_ABORTCONTROL_HPP

#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>
#include <flight/modules/control_tasks/Control.hpp>
#include <vector>
#include <map>

class AbortControl : public Control {
    private:

    public:
        AbortControl();
        void begin() override;
        void execute() override;
};
#endif //FLIGHT_SENSORCONTROL_HPP
