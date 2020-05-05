#ifndef FLIGHT_TASK_HPP
#define FLIGHT_TASK_HPP

#include <flight/modules/mcl/Registry.hpp>
#include <flight/modules/mcl/Flag.hpp>

using namespace std;

class Task {
    protected:
        Registry* registry;
        Flag* flag;

    public:
        virtual ~Task() = default;
        Task(Registry* r, Flag* f)
        : registry(r),
          flag(f) {}
        virtual void initialize() = 0;
        virtual void read() = 0;
        virtual void actuate() = 0;
};


#endif //FLIGHT_TASK_HPP
