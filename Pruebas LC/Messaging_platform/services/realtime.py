import itertools
import json
from queue import Empty, Full, Queue
from threading import Lock


_subscriber_counter = itertools.count(1)
_subscribers = {}
_subscribers_lock = Lock()


def subscribe():
    subscriber_id = next(_subscriber_counter)
    queue = Queue(maxsize=32)

    with _subscribers_lock:
        _subscribers[subscriber_id] = queue

    return subscriber_id, queue


def unsubscribe(subscriber_id):
    with _subscribers_lock:
        _subscribers.pop(subscriber_id, None)


def publish(event_type, payload=None):
    message = {
        "type": str(event_type or "message.updated"),
        "payload": payload or {},
    }

    with _subscribers_lock:
        subscribers = list(_subscribers.items())

    for subscriber_id, queue in subscribers:
        try:
            queue.put_nowait(message)
        except Full:
            try:
                queue.get_nowait()
                queue.put_nowait(message)
            except (Empty, Full):
                unsubscribe(subscriber_id)


def format_sse(event_type, payload):
    encoded_payload = json.dumps(payload or {}, ensure_ascii=False)
    return f"event: {event_type}\ndata: {encoded_payload}\n\n"
