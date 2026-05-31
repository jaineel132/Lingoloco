export const SCENARIOS_DB: Record<string, any> = {
  cafe: { 
    title: 'Ordering at a Cafe', 
    icon: '☕', 
    desc: 'You are visiting a popular local cafe. You want to order a cappuccino and a croissant. The barista might ask if you want it to go or for here.',
    vocab: {
      es: [
        { f: 'Un café, por favor', n: 'A coffee, please' },
        { f: 'Para llevar', n: 'To go' },
        { f: '¿Cuánto cuesta?', n: 'How much does it cost?' }
      ],
      kr: [
        { f: '커피 한 잔 주세요', n: 'A coffee, please' },
        { f: '테이크아웃 할게요', n: 'To go' },
        { f: '얼마예요?', n: 'How much does it cost?' }
      ],
      fr: [
        { f: 'Un café, s\'il vous plaît', n: 'A coffee, please' },
        { f: 'À emporter', n: 'To go' },
        { f: 'Combien ça coûte?', n: 'How much does it cost?' }
      ],
      ja: [
        { f: 'コーヒーをお願いします', n: 'A coffee, please' },
        { f: '持ち帰りで', n: 'To go' },
        { f: 'いくらですか？', n: 'How much does it cost?' }
      ],
      de: [
        { f: 'Einen Kaffee, bitte', n: 'A coffee, please' },
        { f: 'Zum Mitnehmen', n: 'To go' },
        { f: 'Wie viel kostet das?', n: 'How much does it cost?' }
      ],
      it: [
        { f: 'Un caffè, per favore', n: 'A coffee, please' },
        { f: 'Da portare via', n: 'To go' },
        { f: 'Quanto costa?', n: 'How much does it cost?' }
      ],
      zh: [
        { f: '请给我一杯咖啡', n: 'A coffee, please' },
        { f: '打包', n: 'To go' },
        { f: '多少钱？', n: 'How much does it cost?' }
      ],
      pt: [
        { f: 'Um café, por favor', n: 'A coffee, please' },
        { f: 'Para levar', n: 'To go' },
        { f: 'Quanto custa?', n: 'How much does it cost?' }
      ],
      ru: [
        { f: 'Кофе, пожалуйста', n: 'A coffee, please' },
        { f: 'С собой', n: 'To go' },
        { f: 'Сколько это стоит?', n: 'How much does it cost?' }
      ],
      hi: [
        { f: 'एक कॉफी, कृपया', n: 'A coffee, please' },
        { f: 'ले जाने के लिए', n: 'To go' },
        { f: 'यह कितने का है?', n: 'How much does it cost?' }
      ]
    },
    starter: {
      es: '¡Hola! ¿Qué le gustaría pedir hoy?',
      kr: '안녕하세요! 오늘 무엇을 주문하시겠어요?',
      fr: 'Bonjour! Que souhaitez-vous commander aujourd\'hui?',
      ja: 'いらっしゃいませ。ご注文は何になさいますか？',
      de: 'Hallo! Was möchten Sie heute bestellen?',
      it: 'Buongiorno! Cosa le piacerebbe ordinare oggi?',
      zh: '您好！今天想点些什么？',
      pt: 'Olá! O que gostaria de pedir hoje?',
      ru: 'Здравствуйте! Что будете заказывать?',
      hi: 'नमस्ते! आज आप क्या ऑर्डर करना चाहेंगे?'
    }
  },
  airport: {
    title: 'Airport Check-in',
    icon: '✈️',
    desc: 'You arrived at the counter. The agent needs your passport and to know if you are checking bags.',
    vocab: {
      es: [
        { f: 'Mi pasaporte', n: 'My passport' },
        { f: 'No tengo equipaje', n: 'I have no luggage' }
      ],
      kr: [
        { f: '제 여권입니다', n: 'My passport' },
        { f: '수하물이 없습니다', n: 'I have no luggage' }
      ],
      fr: [
        { f: 'Mon passeport', n: 'My passport' },
        { f: 'Je n\'ai pas de bagages', n: 'I have no luggage' }
      ],
      ja: [
        { f: '私のパスポートです', n: 'My passport' },
        { f: '預ける荷物はありません', n: 'I have no luggage' }
      ],
      de: [
        { f: 'Mein Reisepass', n: 'My passport' },
        { f: 'Ich habe kein Gepäck', n: 'I have no luggage' }
      ],
      it: [
        { f: 'Il mio passaporto', n: 'My passport' },
        { f: 'Non ho bagagli', n: 'I have no luggage' }
      ],
      zh: [
        { f: '我的护照', n: 'My passport' },
        { f: '我没有托运行李', n: 'I have no luggage' }
      ],
      pt: [
        { f: 'Meu passaporte', n: 'My passport' },
        { f: 'Não tenho bagagem', n: 'I have no luggage' }
      ],
      ru: [
        { f: 'Мой паспорт', n: 'My passport' },
        { f: 'У меня нет багажа', n: 'I have no luggage' }
      ],
      hi: [
        { f: 'मेरा पासपोर्ट', n: 'My passport' },
        { f: 'मेरे पास कोई सामान नहीं है', n: 'I have no luggage' }
      ]
    },
    starter: {
      es: 'Buenos días. Su pasaporte, por favor.',
      kr: '안녕하세요. 여권 좀 보여주시겠어요?',
      fr: 'Bonjour. Votre passeport, s\'il vous plaît.',
      ja: 'おはようございます。パスポートをお願いします。',
      de: 'Guten Morgen. Ihren Reisepass, bitte.',
      it: 'Buongiorno. Il suo passaporto, per favore.',
      zh: '早上好。请出示您的护照。',
      pt: 'Bom dia. Seu passaporte, por favor.',
      ru: 'Доброе утро. Ваш паспорт, пожалуйста.',
      hi: 'सुप्रभात। अपना पासपोर्ट दें, कृपया।'
    }
  },
  directions: {
    title: 'Asking for Directions',
    icon: '🗺️',
    desc: 'You are lost in the city center. You approach a local to ask for the nearest train station.',
    vocab: {
      es: [
        { f: '¿Dónde está la estación?', n: 'Where is the station?' },
        { f: 'Está lejos?', n: 'Is it far?' }
      ],
      kr: [
        { f: '역이 어디에 있나요?', n: 'Where is the station?' },
        { f: '먼가요?', n: 'Is it far?' }
      ],
      fr: [
        { f: 'Où est la gare?', n: 'Where is the station?' },
        { f: 'C\'est loin?', n: 'Is it far?' }
      ],
      ja: [
        { f: '駅はどこですか？', n: 'Where is the station?' },
        { f: '遠いですか？', n: 'Is it far?' }
      ],
      de: [
        { f: 'Wo ist der Bahnhof?', n: 'Where is the station?' },
        { f: 'Ist es weit?', n: 'Is it far?' }
      ],
      it: [
        { f: 'Dov\'è la stazione?', n: 'Where is the station?' },
        { f: 'È lontano?', n: 'Is it far?' }
      ],
      zh: [
        { f: '火车站怎么走？', n: 'Where is the station?' },
        { f: '远吗？', n: 'Is it far?' }
      ],
      pt: [
        { f: 'Onde fica a estação?', n: 'Where is the station?' },
        { f: 'É longe?', n: 'Is it far?' }
      ],
      ru: [
        { f: 'Где находится вокзал?', n: 'Where is the station?' },
        { f: 'Это далеко?', n: 'Is it far?' }
      ],
      hi: [
        { f: 'स्टेशन कहाँ है?', n: 'Where is the station?' },
        { f: 'क्या यह दूर है?', n: 'Is it far?' }
      ]
    },
    starter: {
      es: '¿Sí? ¿En qué puedo ayudarle?',
      kr: '네? 무엇을 도와드릴까요?',
      fr: 'Oui? Comment puis-je vous aider?',
      ja: 'はい、何かお困りですか？',
      de: 'Ja? Wie kann ich Ihnen helfen?',
      it: 'Sì? Come posso aiutarla?',
      zh: '您好，需要帮忙吗？',
      pt: 'Sim? Como posso ajudar?',
      ru: 'Да? Чем могу помочь?',
      hi: 'जी? मैं आपकी कैसे मदद कर सकता हूँ?'
    }
  }
};
