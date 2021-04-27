#ifndef DESKTOP
    #include <flight/modules/lib/logger_util.hpp>
    #include <flight/modules/drivers/XBee.hpp>
    #include <flight/modules/mcl/Config.hpp>
    #include <flight/modules/lib/Errors.hpp>
    #include <flight/modules/lib/Packet.hpp>

    #include <ArduinoJson.h>
    #include <SoftwareSerial.h>

    XBee::XBee() {
        // Initialize variables
        
        // xbee = new SoftwareSerial(31, 32);
        xbee = &Serial4;
        xbee->begin(9600);
        connection = true;
    }

    queue<string> XBee::read(int num_messages) {
        // print("XBee: Current buffer: " + rcvd);

        // printCritical("------------------------");
        read_buffer();
        if (num_messages > (int) ingest_queue.size() || num_messages == -1){
            num_messages = (int) ingest_queue.size();
        }

        // type of list where elements are exclusively inserted from one side and removed from the other.
        queue<string> q;
        for (int i = 0; i < num_messages; i++){
            q.push(ingest_queue.front());
            ingest_queue.pop();
        }

        return q;
    }

    // Send the next subpacket in queue
    bool XBee::write() {

        // Nothing to send, so j return
        if(subpacket_send_queue.size() == 0 && send_queue.size() == 0){
            return true;
        }

        if(subpacket_send_queue.size() == 0){
            // TODO: Move this to config or constants or smth
            string packet_string = send_queue.front();
            send_queue.pop();
            int subpacket_len = 60;

            for (size_t i = 0; i < packet_string.size(); i += subpacket_len)
            {
                string subpacket_string = packet_string.substr(i, subpacket_len);
                subpacket_send_queue.push(subpacket_string);
            }

        }

        int DELAY_SEND = 50;
        string to_send = subpacket_send_queue.front();
        subpacket_send_queue.pop();
        try {
            char const *c = to_send.c_str();
            print("Sending subpacket: " + string(c));
            xbee->write(c);
        }
        catch (std::exception& e) {
            printCritical(e.what());
            printCritical("HELLO");
            throw XBEE_WRITE_ERROR();
        }
        Util::pause(DELAY_SEND);

        return true;
    }

    void XBee::read_buffer() {
        while (this->connection && !TERMINATE_FLAG && xbee->available()) {
            try {
                // Read in data from socket
                // const char* msg(xbee->read());
                // string msg_str(msg);
                char msg = xbee->read();
                string msg_str(1, msg);
                rcvd.append(msg_str);
                printCritical("XBee: Recieved: " + msg_str);
            }
            catch (std::exception& e){
                print(e.what());
                end();
                throw XBEE_READ_ERROR();
            }
        }

        size_t packet_start = rcvd.find('^');
        if(packet_start != string::npos) {
            size_t packet_end = rcvd.find('$', packet_start);
            if (packet_end != string::npos) {
                string incoming_packet = rcvd.substr(packet_start + 1, packet_end - packet_start - 1);
                printCritical("XBee: Received Full Packet: " + incoming_packet);
                ingest_queue.push(incoming_packet);

                rcvd = rcvd.substr(packet_end + 1);
            }
        }
        // print("xbee: received: " + rcvd);
    }

    bool XBee::get_status() const {
        return connection;
    }

    void XBee::reset() {
        end();
        bool res = connect();
        if (!res) {
            end();
        }
    }

    bool XBee::connect() {
        print("XBee: connecting.");

        // try {
        //     xbee->begin(global_config.telemetry.XBEE_BAUD_RATE);
        // } catch(std::exception& e) {
        //     print(e.what());
        //     throw XBEE_CONNECTION_ERROR();
        // }

        connection = true;
        TERMINATE_FLAG = false;

        return true;
    }

    void XBee::end() {
        TERMINATE_FLAG = true;
        connection = false;
    }

#endif
