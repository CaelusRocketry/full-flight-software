#ifndef FLIGHT_TASK_HPP
#define FLIGHT_TASK_HPP

#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>

using namespace std;

// Parent class for all Tasks

class Task {
    public:
        virtual ~Task() {};
        Task() {};
        virtual void initialize() {};
        virtual void read() {};
        virtual void actuate() {};
};


#endif //FLIGHT_TASK_HPP
