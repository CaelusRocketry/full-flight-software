#ifndef DESKTOP

    #ifndef FLIGHT_XBEE_HPP
    #define FLIGHT_XBEE_HPP

    #include <string>
    #include <queue>
    #include <cstdio>
    #include <unistd.h>
    #include <mutex>
    #include <thread>
    #include <flight/modules/lib/Packet.hpp>

    using namespace std;

    #define RX_PIN 8
    #define TX_PIN 9
    #define BAUD_RATE 9600

    class XBee  {
    private:
        SoftwareSerial xbee(RX_PIN, TX_PIN);
        bool connection;
        queue<string> ingest_queue;
        string rcvd;

        // lockable object used to specify when things need exclusive access.
        mutex mtx;
        thread* recv_thread = nullptr;
        bool TERMINATE_FLAG = false;


    public:
        XBee();
        queue<string> read(int num_messages);
        bool write(const Packet& packet);
        void recv_loop();
        bool get_status() const;
        void reset();
        bool connect();
        void end();
    };


    #endif //FLIGHT_XBEE_HPP

#endif