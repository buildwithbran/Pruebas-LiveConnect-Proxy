import requests
from metodos.Token import obtener_token

def transfer(data):
    token = obtener_token()
    headers = {
        "Content-Type": "application/json",
        "PageGearToken": token
    }

    res = requests.post(
        "https://api.liveconnect.chat/prod/proxy/transfer",
        json=data,
        headers=headers
    )

    return res.json()