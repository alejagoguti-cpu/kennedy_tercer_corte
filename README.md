# Kennedy · Tesis, tercer corte

Presentación web de Kennedy (Bogotá) con la misma estructura que [tesis_tercer_corte](https://alejagoguti-cpu.github.io/tesis_tercer_corte/) (Tierra Bomba).

- **Problema:** red causal interactiva (clic o flechas) y circuitos destructivo y regenerativo.
- **Lectura territorial:** los 18 mapas del encuadre leídos sobre una malla de 154 × 133 celdas:
  - pila de capas en 3D (cada capa sube donde su valor es mayor; arrastrar, pasar el cursor, clic para la ficha),
  - relaciones (normalización, media, ⊕ y √),
  - «Geografías latentes»: relieve 3D con picos interactivos; una capa da la altura y otra el color.
- **Cruces:** pares de capas que abren el relieve con altura A y color B.
- **Plan:** convenciones P1 a P4.
- **Simulador:** duplicado en [simulador-kennedy](https://github.com/alejagoguti-cpu/simulador-kennedy) y embebido.

Los mapas están en `assets/mapas/`. El código 3D (`lectura.js`) está adaptado de `codigo/src/lib/analisis.js` de la referencia.
Los índices E, S, M, V y C son exploratorios con pesos iguales; no son índices validados.
