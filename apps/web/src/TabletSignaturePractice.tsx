import React,{useEffect,useRef,useState} from "react";
import "./signaturePractice.css";

/**
 * WEB-COORD-06: touch/pen/mouse strokes live only inside the canvas.
 * No form submission, serialization, session, storage, export or network.
 * A drawn stroke never creates a signature, attestation or clinical record.
 */
type PracticeRole="profesional"|"cuidador";

function SignatureCanvas(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const activePointer=useRef<number|null>(null);
  const [strokeCount,setStrokeCount]=useState(0);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      const dpr=Math.min(window.devicePixelRatio||1,3);
      canvas.width=Math.max(1,Math.round(rect.width*dpr));
      canvas.height=Math.max(1,Math.round(rect.height*dpr));
      const ctx=canvas.getContext("2d");
      if(ctx){
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.strokeStyle="#114A35";
        ctx.fillStyle="#114A35";
        ctx.lineWidth=2.7;
        ctx.lineCap="round";
        ctx.lineJoin="round";
      }
      activePointer.current=null;
      setStrokeCount(0);
    };
    const observer=new ResizeObserver(resize);
    observer.observe(canvas);
    return()=>observer.disconnect();
  },[]);

  const coords=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  };
  const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    if(activePointer.current!==null||
      (event.pointerType==="mouse"&&event.button!==0))return;
    const canvas=canvasRef.current,ctx=canvas?.getContext("2d");
    if(!canvas||!ctx)return;
    const p=coords(event);
    activePointer.current=event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.arc(p.x,p.y,1.5,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    setStrokeCount(n=>n+1);
  };
  const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    if(activePointer.current!==event.pointerId)return;
    const ctx=canvasRef.current?.getContext("2d");
    if(!ctx)return;
    const p=coords(event);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  };
  const finish=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    if(activePointer.current!==event.pointerId)return;
    activePointer.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId)){
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const clear=()=>{
    const canvas=canvasRef.current,ctx=canvas?.getContext("2d");
    if(ctx&&canvas){
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.restore();
    }
    activePointer.current=null;
    setStrokeCount(0);
  };
  return <div className="signature-practice-ink">
    <p className="signature-practice-instruction" id="signature-practice-instruction">
      Dibujá dentro del recuadro con el dedo o una birome capacitiva universal
      (sin Bluetooth, sin batería y sin lápiz activo especial).
    </p>
    <canvas ref={canvasRef} className="signature-practice-canvas"
      data-testid="signature-practice-canvas"
      role="img" aria-label="Recuadro para practicar un trazo de firma táctil; no se guarda"
      aria-describedby="signature-practice-instruction"
      onPointerDown={start} onPointerMove={move}
      onPointerUp={finish} onPointerCancel={finish}
      onLostPointerCapture={()=>{activePointer.current=null;}}>
      Tu navegador no permite dibujar en este recuadro.
    </canvas>
    <div className="signature-practice-tools">
      <span aria-live="polite" data-testid="signature-stroke-count">
        {strokeCount} {strokeCount===1?"trazo dibujado":"trazos dibujados"}
      </span>
      <button type="button" className="doc-shortcut"
        onClick={clear}>Borrar y volver a dibujar</button>
    </div>
    <p className="signature-practice-muted">
      Si girás la tablet o cambiás el tamaño del recuadro, el dibujo se borra.
      Al cerrar esta ventana se descartan todos los trazos.
    </p>
  </div>;
}

export function TabletSignaturePractice({
  open,onClose,
}:{open:boolean;onClose:()=>void}){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const [role,setRole]=useState<PracticeRole>("profesional");
  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    if(open&&!dialog.open)dialog.showModal();
    if(!open&&dialog.open)dialog.close();
  },[open]);
  return <dialog ref={dialogRef} className="signature-practice-dialog"
    aria-labelledby="signature-practice-title" onClose={onClose}>
    {open?<div className="signature-practice-body">
      <div className="signature-practice-head">
        <div>
          <span className="overline">PEDIATRICS · PRUEBA EN TABLET</span>
          <h2 id="signature-practice-title">Probar recuadro táctil de firma</h2>
        </div>
        <button type="button" onClick={onClose}
          aria-label="Cerrar prueba de firma sin guardar"
          className="signature-practice-close">×</button>
      </div>
      <p className="notice">
        DEMOSTRACIÓN SIN VALIDEZ LEGAL. No firmes tu nombre real.
        Esto no verifica identidades, no acredita atención y no guarda ninguna firma.
      </p>
      <label className="signature-practice-role">
        Persona que practicaría el trazo
        <select aria-label="Seleccionar firmante de demostración"
          value={role} onChange={event=>
            setRole(event.target.value as PracticeRole)}>
          <option value="profesional">Profesional (ejemplo)</option>
          <option value="cuidador">Responsable o cuidador autorizado (ejemplo)</option>
        </select>
      </label>
      <SignatureCanvas key={role}/>
      <p className="signature-practice-muted">
        La firma del profesional y la conformidad del representante tienen
        requisitos distintos. Su autenticación, validez y custodia deberán
        definirse con Pediatrics antes de habilitar historias clínicas.
      </p>
      <button type="button" onClick={onClose}
        className="signature-practice-dismiss">Cerrar y descartar trazos</button>
    </div>:null}
  </dialog>;
}
