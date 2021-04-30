#ifdef DESKTOP 

    #ifndef FLIGHT_TELEMETRY_HPP
    #define FLIGHT_TELEMETRY_HPP

    #include <string>
    #include <queue>
    #include <cstdio>
    #include <asio/impl/src.hpp>
    #include <asio/ip/tcp.hpp>
    #include <asio/write.hpp>
    #include <asio/read.hpp>
    #include <asio/basic_stream_socket.hpp>
    #include <unistd.h>

    using namespace std;
    using asio::ip::tcp;

    class Telemetry {
    private:
        bool connection;
        queue<string> ingest_queue;
        string recv_buffer;

        // lockable object used to specify when things need exclusive access.
        // std::mutex mtx;
        // std::thread* recv_thread = nullptr;
        bool TERMINATE_FLAG = false;

        asio::io_context io_context;
        asio::ip::tcp::socket socket = tcp::socket(io_context);

    public:
        queue<string> send_queue;

        Telemetry();
        queue<string> read(int num_messages);
        bool write();
        // void recv_loop();
        bool get_status() const;
        void reset();
        bool connect();
        void end();
    };

    #endif //FLIGHT_TELEMETRY_HPP

#endif // DESKTOP