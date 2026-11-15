from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import Column, Integer, String, Float, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from datetime import datetime
import os

# --- SQLITE DATABASE CONFIGURATION ---
DATABASE_URL = "sqlite:///./contapro.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- TABLE MODELS ---
class UsuarioDB(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    rol = Column(String, nullable=False)

class CuentaDB(Base):
    __tablename__ = "cuentas"
    codigo = Column(String, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    tipo = Column(String, nullable=False)

class PartidaDB(Base):
    __tablename__ = "partidas"
    id = Column(Integer, primary_key=True, index=True)
    num_asiento = Column(String, unique=True, nullable=False)
    fecha = Column(String, nullable=False)
    concepto = Column(String, nullable=False)
    monto_total = Column(Float, nullable=False)
    registrado_por = Column(String, nullable=False)
    movimientos = relationship("MovimientoDB", back_populates="partida", cascade="all, delete-orphan")

class MovimientoDB(Base):
    __tablename__ = "movimientos"
    id = Column(Integer, primary_key=True, index=True)
    partida_id = Column(Integer, ForeignKey("partidas.id"))
    codigo = Column(String, ForeignKey("cuentas.codigo"))
    nombre = Column(String, nullable=False)
    debe = Column(Float, default=0.0)
    haber = Column(Float, default=0.0)
    partida = relationship("PartidaDB", back_populates="movimientos")

class AuditoriaDB(Base):
    __tablename__ = "auditoria"
    id = Column(Integer, primary_key=True, index=True)
    fecha_hora = Column(String, nullable=False)
    usuario = Column(String, nullable=False)
    rol = Column(String, nullable=False)
    accion = Column(String, nullable=False)
    detalle = Column(String, nullable=False)

Base.metadata.create_all(bind=engine)

def poblar_datos_iniciales():
    db = SessionLocal()
    if not db.query(UsuarioDB).filter(UsuarioDB.email == "contable@firma.com").first():
        admin = UsuarioDB(
            nombre="Juan Pérez",
            email="contable@firma.com",
            password="123",
            rol="Senior Accountant"
        )
        db.add(admin)

    if db.query(CuentaDB).count() == 0:
        catalogo = [
            CuentaDB(codigo="1101", nombre="Cash and Cash Equivalents", tipo="Asset"),
            CuentaDB(codigo="1102", nombre="Accounts Receivable", tipo="Asset"),
            CuentaDB(codigo="1103", nombre="Inventories", tipo="Asset"),
            CuentaDB(codigo="1104", nombre="VAT Tax Credit", tipo="Asset"),
            CuentaDB(codigo="1201", nombre="Property, Plant and Equipment", tipo="Asset"),
            CuentaDB(codigo="2101", nombre="Accounts Payable - Suppliers", tipo="Liability"),
            CuentaDB(codigo="2103", nombre="Taxes Payable / VAT Debit", tipo="Liability"),
            CuentaDB(codigo="2201", nombre="Long-Term Bank Loans", tipo="Liability"),
            CuentaDB(codigo="3101", nombre="Common Stock / Equity", tipo="Equity"),
            CuentaDB(codigo="3102", nombre="Retained Earnings", tipo="Equity"),
            CuentaDB(codigo="4101", nombre="Sales / Service Revenue", tipo="Income"),
            CuentaDB(codigo="5101", nombre="Administrative and Selling Expenses", tipo="Expense"),
            CuentaDB(codigo="5102", nombre="Cost of Goods Sold", tipo="Expense"),
        ]
        db.add_all(catalogo)
    db.commit()
    db.close()

poblar_datos_iniciales()

app = FastAPI(title="ContaPro Enterprise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LoginSchema(BaseModel):
    email: str
    password: str

class RegisterSchema(BaseModel):
    nombre: str
    email: str
    password: str
    rol: str

class MovimientoSchema(BaseModel):
    codigo: str
    nombre: str
    debe: float
    haber: float

class PartidaCreateSchema(BaseModel):
    fecha: str
    concepto: str
    registrado_por: str
    rol_usuario: str
    movimientos: List[MovimientoSchema]

class AIQuerySchema(BaseModel):
    concept: str

def guardar_log(db: Session, usuario: str, rol: str, accion: str, detalle: str):
    log = AuditoriaDB(
        fecha_hora=datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        usuario=usuario,
        rol=rol,
        accion=accion,
        detalle=detalle
    )
    db.add(log)
    db.commit()

@app.post("/api/login")
def login(datos: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(UsuarioDB).filter(
        UsuarioDB.email == datos.email.lower(),
        UsuarioDB.password == datos.password
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    
    guardar_log(db, user.nombre, user.rol, "Sign In", "Successful system access")
    return {"id": user.id, "nombre": user.nombre, "email": user.email, "rol": user.rol}

@app.post("/api/register")
def register(datos: RegisterSchema, db: Session = Depends(get_db)):
    existe = db.query(UsuarioDB).filter(UsuarioDB.email == datos.email.lower()).first()
    if existe:
        raise HTTPException(status_code=400, detail="Email address is already registered.")
    
    nuevo = UsuarioDB(
        nombre=datos.nombre,
        email=datos.email.lower(),
        password=datos.password,
        rol=datos.rol
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    guardar_log(db, nuevo.nombre, nuevo.rol, "Registration", "New user created in the system")
    return {"id": nuevo.id, "nombre": nuevo.nombre, "email": nuevo.email, "rol": nuevo.rol}

@app.get("/api/catalogo")
def obtener_catalogo(db: Session = Depends(get_db)):
    return db.query(CuentaDB).order_by(CuentaDB.codigo).all()

@app.get("/api/partidas")
def obtener_partidas(db: Session = Depends(get_db)):
    partidas = db.query(PartidaDB).order_by(PartidaDB.id.desc()).all()
    resultado = []
    for p in partidas:
        resultado.append({
            "id": p.id,
            "numAsiento": p.num_asiento,
            "fecha": p.fecha,
            "concepto": p.concepto,
            "montoTotal": p.monto_total,
            "registradoPor": p.registrado_por,
            "movimientos": [
                {"codigo": m.codigo, "nombre": m.nombre, "debe": m.debe, "haber": m.haber}
                for m in p.movimientos
            ]
        })
    return resultado

@app.post("/api/partidas")
def crear_partida(datos: PartidaCreateSchema, db: Session = Depends(get_db)):
    tot_debe = sum(m.debe for m in datos.movimientos)
    tot_haber = sum(m.haber for m in datos.movimientos)

    if abs(tot_debe - tot_haber) > 0.001 or tot_debe <= 0:
        raise HTTPException(status_code=400, detail="Unbalanced or zero-amount entry.")

    total_actual = db.query(PartidaDB).count()
    num_asiento = f"AS-{str(total_actual + 1).zfill(4)}"

    nueva_partida = PartidaDB(
        num_asiento=num_asiento,
        fecha=datos.fecha,
        concepto=datos.concepto,
        monto_total=tot_debe,
        registrado_por=datos.registrado_por
    )
    db.add(nueva_partida)
    db.commit()
    db.refresh(nueva_partida)

    for m in datos.movimientos:
        if m.debe > 0 or m.haber > 0:
            mov = MovimientoDB(
                partida_id=nueva_partida.id,
                codigo=m.codigo,
                nombre=m.nombre,
                debe=m.debe,
                haber=m.haber
            )
            db.add(mov)

    db.commit()
    guardar_log(
        db,
        datos.registrado_por,
        datos.rol_usuario,
        "Accounting Entry",
        f"Registered Entry {num_asiento} for ${tot_debe:.2f}"
    )
    return {"mensaje": "Entry saved", "numAsiento": num_asiento}

@app.get("/api/auditoria")
def obtener_auditoria(db: Session = Depends(get_db)):
    logs = db.query(AuditoriaDB).order_by(AuditoriaDB.id.desc()).all()
    return [
        {
            "fechaHora": l.fecha_hora,
            "usuario": l.usuario,
            "rol": l.rol,
            "accion": l.accion,
            "detalle": l.detalle
        }
        for l in logs
    ]

@app.post("/api/ai/raccoon-assist")
def raccoon_account_assistant(query: AIQuerySchema):
    text = query.concept.lower()
    suggestion = "1101 - Cash and Cash Equivalents"
    tip = "Always verify debit and credit equality before posting the journal entry!"
    
    if "rent" in text or "lease" in text:
        suggestion = "5101 - Administrative and Selling Expenses (Rent)"
        tip = "Rent paid for facilities is an operating expense."
    elif "sale" in text or "revenue" in text or "service" in text:
        suggestion = "4101 - Sales / Service Revenue"
        tip = "Revenues increase equity and are credited when earned."
    elif "supply" in text or "material" in text or "expense" in text:
        suggestion = "5101 - Administrative and Selling Expenses"
        tip = "Supplies consumed are debited as administrative expenses."
    elif "tax" in text or "vat" in text:
        suggestion = "1104 - VAT Tax Credit / 2103 - VAT Debit"
        tip = "Ensure correct tax segregation on purchases and sales."
    elif "hello" in text or "hi" in text or "help" in text:
        suggestion = "General Assistant Mode"
        tip = "I'm Raccoon Account! Ask me about account classifications or rules."
        
    return {
        "status": "success",
        "mascot": "Raccoon Account 🦝",
        "suggestion": suggestion,
        "tip": tip
    }

# --- STATIC FILES (FRONTEND) ---
# Sirve automáticamente index.html, style.css y script.js desde la raíz del proyecto
app.mount("/", StaticFiles(directory=".", html=True), name="static")