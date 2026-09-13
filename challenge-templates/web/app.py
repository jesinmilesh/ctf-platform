import os
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

FLAG = os.environ.get("FLAG", "XploitXβ{w3b_qu4n7um_v4ul7_pwn3d}")

INDEX_HTML = """
<!DOCTYPE html>
<html>
<head>
  <title>XPLOITX // SECURE STORAGE FACILITY</title>
  <style>
    body { background: #07090e; color: #00ff9c; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #0c1017; border: 1px solid #1f2937; padding: 2rem; border-radius: 8px; box-shadow: 0 0 20px rgba(0,255,156,0.1); width: 400px; }
    h1 { font-size: 1.2rem; margin-top: 0; }
    input, button { width: 100%; box-sizing: border-box; padding: 10px; margin: 8px 0; background: #05070a; border: 1px solid #1f2937; color: #fff; font-family: monospace; }
    button { background: #00ff9c; color: #000; font-weight: bold; cursor: pointer; }
    button:hover { background: #00d8f6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>VAULT GATEWAY v2.4</h1>
    <p>CLASSIFIED MIL-SPEC TERMINAL</p>
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Username" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">AUTHENTICATE</button>
    </form>
    <!-- Hint: Developers left debug mode toggle in /api/status -->
  </div>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(INDEX_HTML)

@app.route("/health")
def health():
    return jsonify({"status": "healthy", "service": "quantum-vault"}), 200

@app.route("/login", methods=["POST"])
def login():
    user = request.form.get("username", "")
    pwd = request.form.get("password", "")
    if user == "admin" and pwd == "super_classified_quantum_token":
        return jsonify({"success": True, "flag": FLAG})
    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route("/api/status")
def status():
    mode = request.args.get("debug", "0")
    if mode == "1":
        return jsonify({
            "debug": True,
            "internal_admin_token": "super_classified_quantum_token"
        })
    return jsonify({"status": "active", "nodes": 3})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
