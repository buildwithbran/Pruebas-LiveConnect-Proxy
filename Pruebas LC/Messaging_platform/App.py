from queue import Empty

from flask import Flask, Response, jsonify, render_template, request, stream_with_context

from core.message_router import MessageRouter
from Inbox.conversations import get_conversations
from Inbox.messages import get_messages
from DB.database import init_db
from services.realtime import format_sse, subscribe, unsubscribe

init_db()

app = Flask(__name__)
router = MessageRouter()


def _status_from_result(result, default_error_status=502):
    if isinstance(result, dict):
        status = result.get("status_code")
        if isinstance(status, int):
            return status
        if result.get("ok") is False:
            return default_error_status
        if result.get("status") == "error":
            return default_error_status
    return 200


def _payload():
    return request.get_json(silent=True)


def _execute(route_name, payload=None, default_error_status=502):
    result = router.command_for(route_name).execute(payload)
    return jsonify(result), _status_from_result(result, default_error_status=default_error_status)

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

@app.route("/conversations", methods=["GET"])
def api_get_conversations():
    return jsonify(get_conversations())

@app.route("/config/setWebhook", methods=["POST"])
@app.route("/setWebhook", methods=["POST"])
def set_webhook_route():
    return _execute("config.set_webhook", _payload() or {})

@app.route("/config/getWebhook", methods=["POST"])
@app.route("/getWebhook", methods=["POST"])
def get_webhook_route():
    return _execute("config.get_webhook", _payload() or {})

@app.route("/config/balance", methods=["GET"])
@app.route("/balance", methods=["GET"])
def balance_route():
    return _execute("config.balance")

@app.route("/config/channels", methods=["GET"])
def config_channels():
    filters = request.args.to_dict()
    return _execute("config.channels", filters)

@app.route("/messages/<conversation_id>", methods=["GET"])
def api_get_messages(conversation_id):
    return jsonify(get_messages(conversation_id))


@app.route("/events/stream", methods=["GET"])
def events_stream():
    subscriber_id, event_queue = subscribe()

    @stream_with_context
    def event_generator():
        try:
            yield "retry: 2000\n\n"
            yield format_sse("stream.ready", {"ok": True})

            while True:
                try:
                    event = event_queue.get(timeout=25)
                    yield format_sse(event["type"], event.get("payload"))
                except Empty:
                    yield format_sse("stream.heartbeat", {"ok": True})
        finally:
            unsubscribe(subscriber_id)

    return Response(
        event_generator(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.route("/webhook/liveconnect", methods=["POST"])
def webhook():
    return _execute("webhook.receive", _payload(), default_error_status=400)

@app.route("/sendMessage", methods=["POST"])
def api_send_message():
    return _execute("message.send", _payload())

@app.route("/sendQuickAnswer", methods=["POST"])
def api_send_quick_answer():
    return _execute("message.send_quick_answer", _payload())

@app.route("/sendFile", methods=["POST"])
def api_send_file():
    return _execute("message.send_file", _payload())

@app.route("/transfer", methods=["POST"])
def api_transfer():
    return _execute("conversation.transfer", _payload())

if __name__ == "__main__":
    app.run(port=3000)
