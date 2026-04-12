import requests
import time

TOKEN = None
TOKEN_EXPIRA = 0

KEY = ""
SECRET = ""

def obtener_token():
    global TOKEN, TOKEN_EXPIRA

    # Reutiliza token si sigue válido
    if TOKEN and time.time() < TOKEN_EXPIRA:
        return TOKEN

    url = "https://api.liveconnect.chat/prod/account/token"
    body = {"cKey": KEY, "privateKey": SECRET}
    response = requests.post(url, json=body)
    data = response.json()

    # El token se encuentra en 'PageGearToken'
    TOKEN = data.get("PageGearToken")
    
    # LiveConnect define expiración 8 horas, se le resta 1 minuto por seguridad
    TOKEN_EXPIRA = time.time() + 28800 - 60

    print("🔑 Nuevo token generado:", TOKEN[:20] + "...")  # Muestra solo inicio
    return TOKEN