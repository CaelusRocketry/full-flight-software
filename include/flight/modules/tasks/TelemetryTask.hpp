#ifndef FLIGHT_TELEMETRYTASK_HPP
#define FLIGHT_TELEMETRYTASK_HPP

#include <string>
#include <flight/modules/tasks/Task.hpp>
#include <flight/modules/drivers/Telemetry.hpp>

#ifndef DESKTOP
    #include <flight/modules/drivers/XBee.hpp>
#endif


class TelemetryTask : public Task {
private:
#ifdef DESKTOP
    Telemetry telemetry;
#else
    XBee telemetry;
#endif

public:
    TelemetryTask() {}
    void initialize();
    void read();
    void enqueue();
    void actuate();
};


#endif //FLIGHT_TELEMETRYTASK_HPP
