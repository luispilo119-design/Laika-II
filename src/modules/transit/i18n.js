/**
 * Textos del módulo "transit". Toda clave debe existir en es y en en.
 * Las cifras de estas frases salen de las referencias de data.js: si cambias una, revisa la fuente.
 */
export default {
  es: {
    title: 'El viaje',
    desc: 'Los meses de viaje: peligros para el cuerpo, rutina, aislamiento y juegos.',
    tabsLabel: 'Secciones del tránsito',
    tab: {
      trip: 'Viaje',
      hazards: 'Peligros',
      routine: 'Rutina',
      solo: 'Caso solo',
      games: 'Juegos',
    },
    source: 'Fuente',
    disclaimer: 'Información general basada en fuentes públicas de la NASA y la ESA. No es consejo médico ni psicológico.',

    trip: {
      heading: 'El viaje a Marte',
      planned: 'Salida: {departure} · Llegada: {arrival} · {days} días de viaje',
      defaultNotice:
        'Aún no has planeado el viaje. Mientras tanto usamos una duración aproximada de {days} días: una transferencia de Hohmann entre órbitas circulares, calculada con el tamaño de las órbitas de la Tierra y de Marte.',
      planCta: 'Planear el viaje',
      dayLabel: 'Día del viaje',
      dayValue: 'Día {day} de {days}',
      backWeek: '−7 días',
      backDay: '−1 día',
      nextDay: '+1 día',
      nextWeek: '+7 días',
      stagesTitle: 'Etapas del viaje',
      here: 'Estás aquí',
      metersTitle: 'Tu cuerpo en el día {day}',
      metersNote:
        'Los acumulados son estimaciones del equipo: multiplican por los días de viaje los promedios que publica la NASA. No predicen lo que le pasará a una persona concreta.',
    },
    stage: {
      departure: {
        name: 'Salida: pasar a la ingravidez',
        text: 'Cambiar de campo de gravedad altera la orientación, la coordinación entre ojos y manos, el equilibrio y la forma de moverse; algunas personas sufren mareo espacial. Los líquidos del cuerpo se desplazan hacia la cabeza.',
      },
      cruise: {
        name: 'En ruta: meses sin peso',
        text: 'Sin la dieta y el ejercicio adecuados se pierde hueso y músculo, y la radiación se acumula día a día. El sueño se desajusta con facilidad, y el ánimo y la motivación pueden cambiar conforme avanza la misión.',
      },
      arrival: {
        name: 'Llegada: volver a tener peso',
        text: 'En Marte la gravedad es cerca de un tercio de la terrestre. Al pasar de la ingravidez a la gravedad puede haber mareo y desmayos, y hace falta tiempo para adaptarse antes de las tareas críticas.',
      },
    },
    meter: {
      bone: {
        label: 'Densidad de los huesos',
        value: 'entre −{low} % y −{high} %',
        note: 'En vuelo, los huesos que cargan peso pierden en promedio de 1 % a 1.5 % de densidad mineral al mes.',
      },
      dose: {
        label: 'Radiación acumulada',
        value: '{dose} mSv',
        note: 'El instrumento RAD midió en promedio 1.8 mSv por día de rayos cósmicos dentro de la nave que llevó al rover Curiosity a Marte.',
      },
      exercise: {
        label: 'Ejercicio acumulado',
        value: '{hours} h',
        note: 'Las tripulaciones de la estación espacial hacen en promedio dos horas de ejercicio al día para frenar la pérdida de hueso y músculo.',
      },
      comms: {
        label: 'Comunicación con la Tierra',
        value: 'hasta 20 min por trayecto',
        note: 'El retraso crece con la distancia: en Marte, un mensaje tarda hasta 20 minutos en llegar y otros tantos en recibir respuesta.',
      },
    },

    hazards: {
      heading: 'Los cinco peligros del vuelo espacial humano',
      lead: 'El Programa de Investigación Humana de la NASA agrupa los riesgos de un viaje a Marte en cinco peligros. Sus iniciales en inglés forman la sigla RIDGE.',
      what: 'Qué es',
      body: 'Qué le hace al cuerpo',
      counter: 'Cómo se contrarresta',
    },
    hazard: {
      radiation: {
        name: 'Radiación espacial',
        what: 'Fuera del campo magnético y de la atmósfera de la Tierra hay radiación ionizante: rayos cósmicos galácticos y partículas de las tormentas solares. No se ve ni se siente.',
        body: 'Aumenta el riesgo de cáncer y de enfermedades degenerativas, como las del corazón y las cataratas. Los efectos que más pesan son los de largo plazo.',
        counter: 'Blindaje, medición continua de la dosis y procedimientos de operación; por ejemplo, usar la carga y los materiales de la nave como protección.',
      },
      isolation: {
        name: 'Aislamiento y confinamiento',
        what: 'Un grupo pequeño, en un espacio reducido, lejos de todo y durante meses. La falta de sueño, el desajuste del reloj biológico y la sobrecarga de trabajo lo agravan.',
        body: 'Baja el rendimiento y pueden cambiar el ánimo y la motivación. Cuanto más reducido es el espacio y menor el contacto con el exterior, más probables son los problemas de conducta y de pensamiento.',
        counter: 'Selección y entrenamiento de la tripulación, luz LED que ordena el reloj biológico, medición del sueño, una prueba de atención de 10 minutos, diarios personales, actividades con sentido y un huerto a bordo.',
      },
      distance: {
        name: 'Distancia de la Tierra',
        what: 'Marte está en promedio a unos 225 millones de km (140 millones de millas). Un mensaje tarda hasta 20 minutos por trayecto y no hay reabastecimiento.',
        body: 'Una avería o una emergencia médica se resuelve a bordo y con lo que se lleva. La comida y las medicinas deben durar años, y comer siempre lo mismo quita el apetito.',
        counter: 'Entrenamiento médico de toda la tripulación, ecografías entre compañeros, decidir con cuidado qué se empaca y sistemas que reciclan lo que se consume.',
      },
      gravity: {
        name: 'Campos de gravedad',
        what: 'En una misión a Marte hay tres gravedades: ingravidez durante el viaje, cerca de un tercio de la terrestre en Marte y otra vez la de la Tierra al volver.',
        body: 'Los huesos que cargan peso pierden en promedio de 1 % a 1.5 % de densidad mineral al mes y se pierde músculo. Los líquidos suben a la cabeza y pueden afectar la vista. Aumenta el riesgo de cálculos renales.',
        counter: 'Ejercicio aeróbico y de resistencia (unas dos horas al día en la estación espacial), dieta, manguitos de compresión en los muslos y vigilancia de huesos, músculos y vista.',
      },
      hostile: {
        name: 'Ambientes hostiles o cerrados',
        what: 'La nave es casa y máquina a la vez: temperatura, presión, luz, ruido y microbios deben mantenerse bajo control en un espacio cerrado.',
        body: 'Los microbios cambian en el espacio y pasan con más facilidad de una persona a otra. Suben las hormonas del estrés y el sistema inmunitario se altera, lo que puede facilitar alergias y otras enfermedades.',
        counter: 'Vigilar la calidad del aire, cambiar filtros, limpiar superficies y tratar el agua; vacunarse y pasar cuarentena antes de salir; diseñar con cuidado los espacios para vivir y trabajar.',
      },
    },

    routine: {
      heading: 'Rutina de confinamiento',
      lead: 'Reparte las 24 horas de un día de viaje y compara tu plan con lo que dicen las fuentes.',
      sleep: 'Sueño',
      exercise: 'Ejercicio',
      work: 'Trabajo',
      leisure: 'Ocio',
      rest: 'Comidas, higiene y tareas',
      hours: '{h} h',
      less: 'Quitar media hora a {name}',
      more: 'Añadir media hora a {name}',
      barLabel: 'Reparto del día',
      full: 'El día ya tiene sus 24 horas: quita tiempo a otra actividad para añadir aquí.',
      reset: 'Restablecer',
      checksTitle: 'Tu plan frente a las fuentes',
      check: {
        sleepLow:
          'Sueño: {h} h, por debajo de las 7 a 9 horas que necesita un adulto promedio. En el espacio pasa a menudo: en el transbordador y en la estación espacial se duerme en promedio de 6 a 6.5 horas por noche.',
        sleepOk: 'Sueño: {h} h, dentro de las 7 a 9 horas que necesita un adulto promedio.',
        sleepHigh: 'Sueño: {h} h, por encima de las 7 a 9 horas que necesita un adulto promedio.',
        exerciseLow:
          'Ejercicio: {h} h, menos que las dos horas diarias que promedian las tripulaciones de la estación espacial.',
        exerciseOk: 'Ejercicio: {h} h, al nivel de las dos horas diarias de las tripulaciones de la estación espacial.',
        work: 'Trabajo: {h} h. Según la NASA, la sobrecarga de trabajo agrava los efectos del aislamiento.',
        leisure:
          'Ocio: {h} h. Para evitar el aburrimiento, la NASA piensa de antemano en las actividades de la tripulación durante todo el viaje.',
      },
    },

    solo: {
      heading: 'Caso «solo»',
      lead: 'Qué cambia si una persona se queda sola durante el viaje y qué enseñan los estudios de aislamiento.',
      changesTitle: 'Qué cambia',
      change: {
        watch:
          'Nadie más te cuida. En Mars-500 la tripulación vigilaba el estado físico y psicológico propio y el de los demás; a solas, todo ese seguimiento recae en una sola persona.',
        delay:
          'No hay ayuda inmediata. Con hasta 20 minutos de retraso por trayecto, los problemas se resuelven sin el centro de control en tiempo real.',
        contact:
          'Menos contacto, más riesgo. Según la NASA, cuanto menor es el contacto con personas del exterior, más probables son los problemas de conducta y de pensamiento.',
      },
      tipsTitle: 'Qué usan las tripulaciones',
      tip: {
        journal: 'Llevar un diario. Los astronautas lo usan como un lugar seguro para desahogarse.',
        light: 'Cuidar el sueño con la luz. En la estación espacial la iluminación LED ayuda a ordenar el reloj biológico.',
        selftest: 'Medir la propia atención. Una prueba de 10 minutos muestra cuánto afecta el cansancio al rendimiento.',
        exercise: 'Hacer ejercicio. Mantiene sanos el corazón, los huesos y los músculos, la mente alerta y un ánimo más positivo.',
        meaning: 'Dedicar tiempo a algo con sentido, como aprender un idioma o habilidades médicas: ayuda a sostener la moral.',
        garden: 'Cuidar plantas. Un huerto a bordo puede hacer bien al ánimo, además de dar comida fresca.',
      },
      analogsTitle: 'Estudios de aislamiento en la Tierra',
    },
    analog: {
      hera: {
        name: 'HERA · NASA',
        text: 'Un hábitat de unos 60 m² (650 pies cuadrados) donde tripulaciones voluntarias viven misiones simuladas de hasta 45 días.',
      },
      chapea: {
        name: 'CHAPEA · NASA',
        text: 'Cuatro personas viven 378 días en un hábitat aislado de unos 158 m² (1,700 pies cuadrados) que simula una estancia en Marte, con caminatas espaciales simuladas.',
      },
      mars500: {
        name: 'Mars-500 · ESA',
        text: 'Seis personas pasaron 520 días encerradas, entre 2010 y 2011, simulando un viaje completo a Marte con 20 minutos de retraso en las comunicaciones.',
      },
    },

    games: {
      heading: 'Juegos y actividades',
      lead: 'Para los ratos libres del viaje.',
      title: 'Protocolo de guardia',
      rules:
        'La consola enciende varios sistemas en orden. Memoriza el protocolo y repítelo tocando los mismos sistemas. Cada ronda es más larga y, desde la cuarta, algunas se repiten en orden inverso.',
      consoleLabel: 'Consola de sistemas',
      start: 'Empezar',
      again: 'Jugar otra vez',
      round: 'Ronda {n}',
      points: '{points} puntos',
      idle: 'Pulsa «Empezar» cuando quieras.',
      watch: 'Ronda {n}: memoriza el protocolo…',
      watchReversed: 'Ronda {n}: memoriza… y prepárate para repetirlo AL REVÉS.',
      turn: 'Tu turno: mismo orden.',
      turnReversed: 'Tu turno: orden inverso, del último al primero.',
      good: '¡Protocolo correcto!',
      over: 'Fin de la guardia: {points} puntos en {rounds} rondas completas.',
      aliasLabel: 'Tu alias (hasta {max} caracteres)',
      save: 'Guardar puntuación',
      savedCloud: 'Puntuación guardada en la nube.',
      savedLocal: 'Puntuación guardada en este dispositivo.',
      boardTitle: 'Mejores puntuaciones',
      boardCloud: 'De todas las tripulaciones',
      boardLocal: 'De este dispositivo',
      boardEmpty: 'Todavía no hay puntuaciones.',
      activitiesTitle: 'Actividades sin pantalla',
    },
    tile: {
      o2: 'Oxígeno',
      co2: 'Dióxido de carbono',
      h2o: 'Agua',
      pwr: 'Energía',
      com: 'Radio',
      nav: 'Rumbo',
      tmp: 'Temperatura',
      prs: 'Presión',
      lux: 'Luz',
    },
    activity: {
      journal: { name: 'Bitácora personal', how: 'Escribe a mano sobre tu día: qué salió bien y qué te frustró.' },
      garden: { name: 'Huerto a bordo', how: 'Riega, mide y anota cómo crece cada planta.' },
      learn: { name: 'Aprender algo nuevo', how: 'Practica un idioma o una técnica de primeros auxilios.' },
      exercise: {
        name: 'Circuito de ejercicio',
        how: 'Alterna ejercicio aeróbico y de resistencia hasta completar tus dos horas del día.',
      },
      library: {
        name: 'Lectura y estudio',
        how: 'Un capítulo de un libro o un tema que estudies por tu cuenta, como hacía la tripulación de Mars-500.',
      },
      letter: {
        name: 'Carta a casa',
        how: 'Escribe un mensaje para la Tierra. Con hasta 20 minutos de retraso por trayecto no hay conversación: se escribe como una carta.',
      },
    },
  },

  en: {
    title: 'The journey',
    desc: 'The months of travel: hazards to the body, routine, isolation and games.',
    tabsLabel: 'Transit sections',
    tab: {
      trip: 'Trip',
      hazards: 'Hazards',
      routine: 'Routine',
      solo: 'Alone',
      games: 'Games',
    },
    source: 'Source',
    disclaimer: 'General information based on public NASA and ESA sources. It is not medical or psychological advice.',

    trip: {
      heading: 'The trip to Mars',
      planned: 'Departure: {departure} · Arrival: {arrival} · {days} days of travel',
      defaultNotice:
        'You have not planned the trip yet. For now we use an approximate duration of {days} days: a Hohmann transfer between circular orbits, computed from the size of the orbits of Earth and Mars.',
      planCta: 'Plan the trip',
      dayLabel: 'Day of the trip',
      dayValue: 'Day {day} of {days}',
      backWeek: '−7 days',
      backDay: '−1 day',
      nextDay: '+1 day',
      nextWeek: '+7 days',
      stagesTitle: 'Stages of the trip',
      here: 'You are here',
      metersTitle: 'Your body on day {day}',
      metersNote:
        'The running totals are team estimates: they multiply averages published by NASA by the days of travel. They do not predict what will happen to a specific person.',
    },
    stage: {
      departure: {
        name: 'Departure: into weightlessness',
        text: 'Switching gravity fields affects spatial orientation, hand-eye coordination, balance and the way you move; some people get space motion sickness. Body fluids shift toward the head.',
      },
      cruise: {
        name: 'En route: months without weight',
        text: 'Without the right diet and exercise you lose bone and muscle, and radiation adds up day after day. Sleep slips out of sync easily, and mood and motivation can change as the mission unfolds.',
      },
      arrival: {
        name: 'Arrival: weight comes back',
        text: 'On Mars gravity is about one third of Earth’s. Going from weightlessness to gravity can cause lightheadedness and fainting, and it takes time to adjust before critical tasks.',
      },
    },
    meter: {
      bone: {
        label: 'Bone density',
        value: 'between −{low}% and −{high}%',
        note: 'In flight, weight-bearing bones lose on average 1% to 1.5% of mineral density per month.',
      },
      dose: {
        label: 'Accumulated radiation',
        value: '{dose} mSv',
        note: 'The RAD instrument measured an average of 1.8 mSv per day of cosmic rays inside the spacecraft that carried the Curiosity rover to Mars.',
      },
      exercise: {
        label: 'Accumulated exercise',
        value: '{hours} h',
        note: 'Space station crews exercise for an average of two hours a day to slow bone and muscle loss.',
      },
      comms: {
        label: 'Communication with Earth',
        value: 'up to 20 min one way',
        note: 'The delay grows with distance: at Mars, a message takes up to 20 minutes to arrive and as long again for the reply.',
      },
    },

    hazards: {
      heading: 'The five hazards of human spaceflight',
      lead: 'NASA’s Human Research Program groups the risks of a trip to Mars into five hazards. Their initials spell RIDGE.',
      what: 'What it is',
      body: 'What it does to the body',
      counter: 'How it is countered',
    },
    hazard: {
      radiation: {
        name: 'Space radiation',
        what: 'Beyond Earth’s magnetic field and atmosphere there is ionizing radiation: galactic cosmic rays and particles from solar storms. You cannot see it or feel it.',
        body: 'It raises the risk of cancer and of degenerative diseases such as heart disease and cataracts. The effects that matter most are long-term.',
        counter: 'Shielding, continuous dose monitoring and operational procedures; for example, using the spacecraft’s cargo and materials as protection.',
      },
      isolation: {
        name: 'Isolation and confinement',
        what: 'A small group, in a small space, far from everything, for months. Sleep loss, a body clock out of sync and work overload make it worse.',
        body: 'Performance drops, and mood and motivation can change. The more restricted the space and the less contact with the outside, the more likely behavioral and cognitive problems become.',
        counter: 'Crew selection and training, LED lighting that keeps the body clock aligned, sleep monitoring, a 10-minute attention self-test, personal journals, meaningful activities and a garden on board.',
      },
      distance: {
        name: 'Distance from Earth',
        what: 'Mars is on average about 225 million km (140 million miles) away. A message takes up to 20 minutes one way and there is no resupply.',
        body: 'A breakdown or a medical emergency is handled on board, with what was packed. Food and medicine must last for years, and eating the same meals over and over kills the appetite.',
        counter: 'Medical training for the whole crew, ultrasound scans on each other, careful choices about what to pack and systems that recycle what is consumed.',
      },
      gravity: {
        name: 'Gravity fields',
        what: 'A Mars mission has three gravities: weightlessness during the trip, about one third of Earth’s on Mars and Earth’s again on the way home.',
        body: 'Weight-bearing bones lose on average 1% to 1.5% of mineral density per month and muscle is lost. Fluids shift to the head and may affect vision. The risk of kidney stones goes up.',
        counter: 'Aerobic and resistive exercise (about two hours a day on the space station), diet, compression cuffs on the thighs and monitoring of bones, muscles and vision.',
      },
      hostile: {
        name: 'Hostile or closed environments',
        what: 'The spacecraft is both a home and a machine: temperature, pressure, lighting, noise and microbes must be kept under control in a closed space.',
        body: 'Microbes change in space and pass more easily from person to person. Stress hormones rise and the immune system is altered, which could make allergies and other illnesses more likely.',
        counter: 'Monitoring air quality, changing filters, cleaning surfaces and treating the water; vaccination and quarantine before launch; careful design of living and working quarters.',
      },
    },

    routine: {
      heading: 'Confinement routine',
      lead: 'Split the 24 hours of a travel day and compare your plan with what the sources say.',
      sleep: 'Sleep',
      exercise: 'Exercise',
      work: 'Work',
      leisure: 'Leisure',
      rest: 'Meals, hygiene and chores',
      hours: '{h} h',
      less: 'Take half an hour from {name}',
      more: 'Add half an hour to {name}',
      barLabel: 'How the day is split',
      full: 'The day already has its 24 hours: take time from another activity to add some here.',
      reset: 'Reset',
      checksTitle: 'Your plan against the sources',
      check: {
        sleepLow:
          'Sleep: {h} h, below the 7 to 9 hours an average adult needs. It happens often in space: shuttle and space station crews average 6 to 6.5 hours a night.',
        sleepOk: 'Sleep: {h} h, within the 7 to 9 hours an average adult needs.',
        sleepHigh: 'Sleep: {h} h, above the 7 to 9 hours an average adult needs.',
        exerciseLow: 'Exercise: {h} h, less than the two hours a day that space station crews average.',
        exerciseOk: 'Exercise: {h} h, in line with the two hours a day of space station crews.',
        work: 'Work: {h} h. According to NASA, work overload makes the effects of isolation worse.',
        leisure: 'Leisure: {h} h. To prevent boredom, NASA thinks ahead about what crews will do during the whole trip.',
      },
    },

    solo: {
      heading: 'The “alone” case',
      lead: 'What changes if one person is left alone during the trip, and what isolation studies teach.',
      changesTitle: 'What changes',
      change: {
        watch:
          'Nobody else looks after you. In Mars-500 the crew monitored their own physical and psychological state and each other’s; alone, all of that falls on one person.',
        delay: 'There is no immediate help. With up to 20 minutes of delay one way, problems are solved without mission control in real time.',
        contact:
          'Less contact, more risk. According to NASA, the less contact with people outside, the more likely behavioral and cognitive problems become.',
      },
      tipsTitle: 'What crews use',
      tip: {
        journal: 'Keeping a journal. Astronauts use it as a safe place to vent.',
        light: 'Protecting sleep with light. On the space station, LED lighting helps keep the body clock aligned.',
        selftest: 'Checking your own attention. A 10-minute self-test shows how much fatigue affects performance.',
        exercise: 'Exercising. It keeps the heart, bones and muscles healthy, the mind alert and the outlook more positive.',
        meaning: 'Spending time on something meaningful, such as learning a language or medical skills: it helps keep morale up.',
        garden: 'Tending plants. A garden on board may be good for mood, besides providing fresh food.',
      },
      analogsTitle: 'Isolation studies on Earth',
    },
    analog: {
      hera: {
        name: 'HERA · NASA',
        text: 'A habitat of about 60 m² (650 square feet) where volunteer crews live simulated missions of up to 45 days.',
      },
      chapea: {
        name: 'CHAPEA · NASA',
        text: 'Four people live for 378 days in an isolated habitat of about 158 m² (1,700 square feet) that simulates a stay on Mars, with simulated spacewalks.',
      },
      mars500: {
        name: 'Mars-500 · ESA',
        text: 'Six people spent 520 days sealed in, between 2010 and 2011, simulating a full trip to Mars with a 20-minute communication delay.',
      },
    },

    games: {
      heading: 'Games and activities',
      lead: 'For the free time during the trip.',
      title: 'Watch protocol',
      rules:
        'The console lights up several systems in order. Memorize the protocol and repeat it by tapping the same systems. Each round is longer and, from the fourth on, some are repeated in reverse order.',
      consoleLabel: 'Systems console',
      start: 'Start',
      again: 'Play again',
      round: 'Round {n}',
      points: '{points} points',
      idle: 'Press “Start” when you are ready.',
      watch: 'Round {n}: memorize the protocol…',
      watchReversed: 'Round {n}: memorize… and get ready to repeat it BACKWARDS.',
      turn: 'Your turn: same order.',
      turnReversed: 'Your turn: reverse order, from last to first.',
      good: 'Protocol correct!',
      over: 'End of watch: {points} points in {rounds} completed rounds.',
      aliasLabel: 'Your alias (up to {max} characters)',
      save: 'Save score',
      savedCloud: 'Score saved to the cloud.',
      savedLocal: 'Score saved on this device.',
      boardTitle: 'Top scores',
      boardCloud: 'From all crews',
      boardLocal: 'From this device',
      boardEmpty: 'No scores yet.',
      activitiesTitle: 'Activities away from the screen',
    },
    tile: {
      o2: 'Oxygen',
      co2: 'Carbon dioxide',
      h2o: 'Water',
      pwr: 'Power',
      com: 'Radio',
      nav: 'Heading',
      tmp: 'Temperature',
      prs: 'Pressure',
      lux: 'Light',
    },
    activity: {
      journal: { name: 'Personal log', how: 'Write by hand about your day: what went well and what frustrated you.' },
      garden: { name: 'Garden on board', how: 'Water, measure and note how each plant grows.' },
      learn: { name: 'Learn something new', how: 'Practice a language or a first-aid technique.' },
      exercise: {
        name: 'Exercise circuit',
        how: 'Alternate aerobic and resistive exercise until you complete your two hours for the day.',
      },
      library: {
        name: 'Reading and study',
        how: 'A chapter of a book or a subject you study on your own, as the Mars-500 crew did.',
      },
      letter: {
        name: 'Letter home',
        how: 'Write a message for Earth. With up to 20 minutes of delay one way there is no conversation: you write it like a letter.',
      },
    },
  },
};
