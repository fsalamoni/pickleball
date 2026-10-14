/**
 * Courtesy translation (English) of the legal documents. The Portuguese text in
 * `domain/legalDocuments.js` is the binding version. `fonte` is the fingerprint
 * of the Portuguese text this translation was made from (`legalSourceHash`).
 */
import { LEGAL_CONTACT_EMAIL } from '../../domain/legalDocuments.js';

export default {
  'termos-de-uso': {
    fonte: '39661c5e',
    title: 'Terms of Use',
    eyebrow: 'Essential document',
    description: 'General conditions governing the use of the PickleRush platform by all users.',
    sections: [
      {
        title: 'Nature of the platform',
        description: 'A technology tool for the pickleball community.',
        paragraphs: [
          'PickleRush is a technology platform (web app/PWA) that connects the amateur pickleball community in Brazil: athletes, tournament organizers, clubs, arenas and coaches. The platform provides tools for creating and managing tournaments, court bookings, lessons, clubs, rankings, community and messaging.',
          'PickleRush is a technology facilitator. It does not organize events, provide courts, give lessons or process payments, and it is not a party to the relationships between users (for example, between an athlete and an arena, or between a student and a coach). The amounts displayed are the responsibility of whoever enters them and serve only as a reference.',
        ],
      },
      {
        title: 'Account, eligibility and registration',
        paragraphs: [
          'To use authenticated features you must create an account with true, complete and up-to-date information. You are responsible for keeping your credentials confidential and for all activity carried out in your account.',
        ],
        bullets: [
          'Creating accounts with a false identity or impersonating others is prohibited.',
          'Minors under 18 may only use the platform with the consent and supervision of their legal guardians (see the Risk Acknowledgment and Liability Waiver and the Privacy Policy).',
          'PickleRush may suspend or terminate accounts that violate these Terms.',
        ],
      },
      {
        title: 'Acceptable use',
        description: 'What is expected of every user.',
        bullets: [
          'Comply with applicable law, the rules of the sport (CBP/USAP) and fair play.',
          'Do not enter fraudulent results or manipulate rankings, registrations or skill levels.',
          'Do not post content that is illegal, offensive, discriminatory, spam or that infringes the rights of others.',
          'Do not attempt to circumvent security, reverse engineer, scrape or overload the platform.',
        ],
      },
      {
        title: 'User content and intellectual property',
        paragraphs: [
          'You retain ownership of the content you post (name, photos, texts, results). By posting it, you grant PickleRush a non-exclusive license to host and display that content in the normal operation of the platform (for example, showing your name in a tournament bracket).',
          'The PickleRush brand, design, code and other elements are protected and may not be copied or reused without authorization.',
        ],
      },
      {
        title: 'Disclaimers and limitation of liability',
        paragraphs: [
          'The platform is provided "as is". PickleRush does not guarantee uninterrupted availability and is not responsible for the conduct of users, for whether events, lessons and bookings take place or their quality, or for losses arising from relationships entered into between users.',
          'To the fullest extent permitted by law, PickleRush\'s liability is limited to the operation of the technology tool.',
        ],
      },
      {
        title: 'Changes, termination and jurisdiction',
        paragraphs: [
          'These Terms may be updated to reflect changes in functionality or legal requirements. Material changes will require new acceptance. The current version is always the one published in this center.',
          'You may close your account at any time. Brazilian law applies, and the courts of the consumer\'s place of residence are chosen as the venue where applicable.',
        ],
      },
    ],
  },

  privacidade: {
    fonte: '1137e065',
    title: 'Privacy Policy',
    eyebrow: 'Essential document · LGPD',
    description: 'How we process, protect and share your personal data, in accordance with the LGPD (Brazil\'s General Data Protection Law, Law 13,709/2018).',
    sections: [
      {
        title: 'Data we collect',
        bullets: [
          'Registration: name, email and, when provided, display name, phone number, city/state and date of birth.',
          'Sports activity: registrations, results, rankings, skill levels, bookings, lessons, clubs and messages.',
          'Technical: device/session identifiers and audit logs of administrative actions.',
          'Photos and media you choose to upload (profile photo, arena/club images).',
        ],
      },
      {
        title: 'Purposes and legal bases',
        paragraphs: [
          'We process data to: operate the platform and its features (performance of a contract); calculate rankings and organize events (legitimate sporting interest); comply with legal obligations; and, where applicable, based on your consent (for example, optional communications).',
        ],
      },
      {
        title: 'Visibility and sharing',
        paragraphs: [
          'Your name, registrations, results and rankings are visible to other participants in the same context (tournament, club, game day). Contact details (phone, email) are not displayed publicly.',
          'We share data only with processors required to provide the service (for example, cloud infrastructure — Google Firebase) and when required by law. We do not sell personal data.',
        ],
      },
      {
        title: 'Data subject rights',
        paragraphs: [
          'Under the LGPD, you may request confirmation of processing, access, correction, anonymization, portability, information about sharing, and deletion of data processed on the basis of consent.',
        ],
        bullets: [
          `Requests may be sent to the data protection officer's email: ${LEGAL_CONTACT_EMAIL}.`,
          'You can export your data in JSON from the Settings page.',
          'Deleting your account removes your personal data, except for data the law requires us to retain.',
        ],
      },
      {
        title: 'Security, retention and minors',
        paragraphs: [
          'We adopt technical and organizational measures to protect your data (access control through security rules and auditing). We retain data for as long as necessary for its purposes or to meet legal obligations.',
          'Data of minors is processed in the best interest of the minor and requires the consent of the legal guardian.',
        ],
      },
      {
        title: 'Changes',
        paragraphs: [
          'This policy may be updated. Material changes will require new acceptance, and the current version will always be published in this center.',
        ],
      },
    ],
  },

  'riscos-e-responsabilidade': {
    fonte: '20f947f5',
    title: 'Risk Acknowledgment and Liability Waiver',
    eyebrow: 'Essential document',
    description: 'Acknowledgment of the risks inherent in playing sports and in taking part in events, bookings and lessons organized by third parties.',
    sections: [
      {
        title: 'Risks of physical activity',
        paragraphs: [
          'Pickleball is a physical activity that involves inherent risks, including falls, muscle and joint injuries, contact and unforeseen events. By taking part in games, game days, tournaments, lessons and bookings, you declare that you are aware of these risks and fit to play.',
        ],
        bullets: [
          'A medical evaluation is recommended before starting or intensifying sports practice.',
          'You are responsible for respecting your limits, warming up and using appropriate equipment.',
        ],
      },
      {
        title: 'Responsibility for organization and venues',
        paragraphs: [
          'Events, lessons and bookings are organized and run by users (organizers, arenas, coaches, clubs), not by PickleRush. Venue safety, supervision, first aid and compliance with regulations are the responsibility of whoever organizes the activity and/or operates the venue.',
        ],
      },
      {
        title: 'Platform liability waiver',
        paragraphs: [
          'To the fullest extent permitted by law, you release PickleRush from liability for personal injury or property damage arising from sports practice or from events, lessons or bookings arranged through the platform. PickleRush provides the technology tool, not the activity itself.',
        ],
      },
      {
        title: 'Minors and guardians',
        paragraphs: [
          'When the participant is a minor, the legal guardian declares awareness of these risks and takes responsibility for the minor\'s participation, authorizing it under the terms of this document.',
        ],
      },
    ],
  },

  'politica-de-uso': {
    fonte: 'f2464c4b',
    title: 'Use Policy',
    eyebrow: 'Supplementary',
    description: 'General conditions for using the platform: the sporting nature of the tool, expected conduct and acceptable use.',
    sections: [
      {
        title: 'Nature of the platform',
        description: 'A sports tool for the amateur pickleball community.',
        paragraphs: [
          'PickleRush is a technology tool for the amateur pickleball community in Brazil: creating and managing tournaments, court bookings, lessons, clubs, rankings, community and messaging. Organizers create tournaments, set rules, open registrations, draw brackets, enter results and calculate rankings.',
          'The platform does not organize events, provide courts, manage prizes or process payments. The amounts displayed (for example, a registration fee) serve only as a reference; collection and financial control are the responsibility of whoever enters them.',
        ],
      },
      {
        title: 'Conduct and responsibility',
        description: 'Each user is responsible for their own actions.',
        paragraphs: [
          'Use must comply with applicable law, the rules of the sport (CBP/USAP) and the principles of fair play. Fraud in entering results, false identity or offending other users may lead to suspension of the account and of the tournament.',
        ],
      },
      {
        title: 'Acceptable use',
        bullets: [
          'Provide true information and keep your account secure.',
          'Do not manipulate rankings, registrations, skill levels or results.',
          'Do not post illegal, offensive or discriminatory content or spam.',
          'Do not attempt to circumvent security, reverse engineer or scrape the platform.',
        ],
      },
      {
        title: 'Privacy and data',
        paragraphs: [
          'Personal data is processed in accordance with the Privacy Policy, available in this center. Names, registrations, results and rankings are visible to other participants in the same context; contact details (phone, email) are not displayed publicly.',
        ],
      },
      {
        title: 'Changes',
        paragraphs: [
          'This policy may be updated to reflect changes in functionality, legal or security requirements. The current version will always be the one published in this center.',
        ],
      },
    ],
  },

  cookies: {
    fonte: '7874b71f',
    title: 'Cookie Policy',
    eyebrow: 'Supplementary',
    description: 'How we use cookies and similar technologies to operate and improve the platform.',
    sections: [
      {
        title: 'What we use',
        bullets: [
          'Essential cookies/storage: login session, preferences (theme, navigation) and security.',
          'Local storage (localStorage): interface state and PWA features (offline use/installation).',
          'We do not use third-party advertising cookies.',
        ],
      },
      {
        title: 'Management',
        paragraphs: [
          'You can clear or block cookies/storage in your browser settings. Some essential features may stop working properly without them.',
        ],
      },
    ],
  },

  'diretrizes-comunidade': {
    fonte: '99fdd797',
    title: 'Community Guidelines',
    eyebrow: 'Supplementary',
    description: 'Rules of conduct for the feed, forums, chat, clubs and other social spaces on the platform.',
    sections: [
      {
        title: 'Respect is the rule',
        paragraphs: [
          'The social spaces (community, club forums, chat, reviews) exist to bring people together. Treat everyone with respect, on and off the court.',
        ],
      },
      {
        title: 'Prohibited conduct',
        bullets: [
          'Hate speech, discrimination, harassment, threats or bullying.',
          'Sexual, violent or illegal content, or content that exposes others without their consent.',
          'Spam, scams, chain messages and unauthorized advertising.',
          'Misinformation about results, rankings or athletes\' identities.',
        ],
      },
      {
        title: 'Moderation and reports',
        paragraphs: [
          'Content and accounts that violate these guidelines may be removed or suspended. Arena reviews and club content are moderated. Reports can be sent through the channels available on the platform or to support.',
        ],
      },
    ],
  },

  'pagamentos-reembolsos': {
    fonte: 'd93a50db',
    title: 'Payments and Refunds Policy',
    eyebrow: 'Supplementary',
    description: 'How the amounts displayed, payments between users and refunds work.',
    sections: [
      {
        title: 'The platform does not process payments',
        paragraphs: [
          'PickleRush currently does not broker or process payments. Registration, booking, lesson, membership and product amounts are set and charged directly by the responsible organizer, arena, coach or club — for example, via a PIX (Brazil\'s instant payment system) key they provide.',
          'Payment instructions (such as a PIX key) displayed on the platform are provided by those responsible parties. Always check the details before paying.',
        ],
      },
      {
        title: 'Confirmation and receipts',
        paragraphs: [
          'Payment confirmation is done manually by the responsible party (for example, the tournament admin marks the registration as paid). Keep your receipts. PickleRush only records the status reported by the responsible parties.',
        ],
      },
      {
        title: 'Refunds',
        paragraphs: [
          'Refund requests must be handled directly with whoever received the payment (organizer, arena, coach or club), in accordance with the applicable cancellation policy. PickleRush does not hold any funds and therefore does not issue refunds.',
        ],
      },
    ],
  },

  cancelamento: {
    fonte: '5a503ae3',
    title: 'Cancellation Policy',
    eyebrow: 'Supplementary',
    description: 'General rules for cancelling registrations, bookings and lessons.',
    sections: [
      {
        title: 'Cancellations depend on each provider',
        paragraphs: [
          'Each arena, organizer, coach and club may set its own cancellation rules and deadlines. When a cancellation policy is configured (for example, a minimum notice period for a booking), the platform displays and applies that deadline.',
        ],
      },
      {
        title: 'Late cancellations and no-shows',
        bullets: [
          'Cancellations made after the deadline may be flagged as late.',
          'Failing to show up without notice (no-show) may be recorded by the arena.',
          'Any charges or penalties are the responsibility of the respective provider, not PickleRush.',
        ],
      },
    ],
  },

  'termos-mercado': {
    fonte: 'ffb54f38',
    title: 'Marketplace General Terms',
    eyebrow: 'Marketplace · General terms',
    description: 'What the PickleRush Marketplace is, what it is not, and the rules that apply to buyers and sellers.',
    sections: [
      {
        title: '1. What the Marketplace is',
        description: 'A listings space that connects people who want to sell with people who want to buy.',
        paragraphs: [
          'The Marketplace is the area of PickleRush where athletes, coaches, arenas and shops publish listings for pickleball-related products. PickleRush acts solely as an internet application provider under Law No. 12,965/2014, the Marco Civil da Internet (Brazil\'s Internet Civil Rights Framework): it offers the space for listings and tools so that interested people can find each other and talk.',
          'These General Terms apply to everyone who uses the Marketplace. They are supplemented by the Buyer Terms, the Seller Terms and the Policy on Images, Videos and AI-Generated Content, and are in addition to the platform\'s Terms of Use, Privacy Policy and Community Guidelines. In case of conflict, the Marketplace-specific rules prevail with respect to the Marketplace.',
        ],
      },
      {
        title: '2. What PickleRush is not and does not do',
        description: 'PickleRush takes no part in the deal made between the parties.',
        bullets: [
          'It is not the seller, supplier, manufacturer, importer, distributor or owner of the listed products.',
          'It is not a party to the sales contract, nor a payment intermediary, broker, agent, representative, custodian or guarantor of either party.',
          'It does not receive, hold, retain or transfer funds: payment goes directly from the buyer to the seller, by whatever means they use.',
          'It charges no commission on sales and does not set the price, shipping, deadlines, delivery method, warranty or any other condition of the deal.',
          'It does not store, inspect, test, package, ship or deliver products, and it does not hire or recommend carriers.',
          'It does not issue invoices, receipts or warranty certificates on anyone\'s behalf, and it does not collect taxes owed by the parties.',
          'It does not verify or guarantee the existence, ownership, origin, authenticity, quality, safety, legality or condition of the products, the accuracy of listings, photos and videos, or the identity, capacity or solvency of buyers and sellers.',
        ],
      },
      {
        title: '3. The deal is between buyer and seller',
        paragraphs: [
          'A purchase made from a listing is a contract entered into directly and exclusively between buyer and seller (Brazilian Civil Code, arts. 481 et seq.). The decision to negotiate, the agreed conditions, payment, delivery, exchange, return and warranty, as well as the rights and obligations arising from the deal, belong to them and them alone.',
          'When the seller is a supplier (a shop, an arena or someone who sells habitually), the relationship with the buyer is a consumer relationship and the seller is liable to the buyer under the CDC (Brazil\'s Consumer Protection Code). Between private individuals, what was agreed and the Civil Code apply, including the rules on hidden defects (arts. 441 to 446).',
        ],
      },
      {
        title: '4. The Marketplace tools',
        bullets: [
          'Orders, offers, the cart, messages, questions, reviews, coupons, notifications and the order issue report are tools for organization and communication between the parties.',
          'Order statuses ("accepted", "paid", "shipped", "received") are reported by the parties themselves. They are not a receipt, proof of payment, proof of delivery or a guarantee given by PickleRush.',
          'The issue report lets the parties record in writing what happened and lets PickleRush assess measures regarding listings and accounts. It is not arbitration or mediation, it does not bind the parties, it does not replace the seller\'s own customer service, and it does not prevent anyone from going to Procon (consumer protection agency), consumidor.gov.br or the courts.',
          'Using the tools does not make PickleRush a participant in the deal or create any obligation on its part to guarantee the outcome of the purchase.',
        ],
      },
      {
        title: '5. What PickleRush does',
        bullets: [
          'Keeps the Marketplace running with reasonable care, without promising that it will always be available or free of failures.',
          'Processes personal data in accordance with the LGPD (Brazil\'s General Data Protection Law, Law No. 13,709/2018) and the Privacy Policy, showing contact and delivery details only to those who need them to complete the order.',
          'May refuse, pause or remove listings, and warn, suspend or terminate accounts that breach these documents or the law, on its own initiative or following a report, without any duty to monitor what is published in advance.',
          'Complies with orders from the authorities and the courts and cooperates with them as provided by law.',
        ],
      },
      {
        title: '6. Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, PickleRush is not liable for losses and damages arising from the deal between the parties, such as: products not delivered, delivered late, lost or damaged in transit; products different from the listing, defective, counterfeit or of unlawful origin; payments made and not acknowledged, or made to the wrong person; scams and fraud committed by users or third parties, especially outside the platform; withdrawal, default or conduct of either party; and in-person meetings arranged between them.',
          'Nothing in these documents excludes rights guaranteed by law that cannot be waived. PickleRush is liable, as provided by law, for its own acts and for the operation of the tool it offers.',
        ],
      },
      {
        title: '7. Security and scam prevention',
        bullets: [
          'Agree on and record everything through the Marketplace order and messages. Be wary of anyone who asks to negotiate or pay outside the platform.',
          'Before paying, check that the name of the person receiving the Pix (Brazil\'s instant payment system) matches the seller shown in the order.',
          'Never send passwords, verification codes or photos of documents. PickleRush never asks for this information.',
          'For pick-up meetings, choose busy public places during the day, and check the product before completing the deal.',
          'If you fall for a Pix scam, contact your bank immediately (the Central Bank has a refund mechanism for fraud cases) and file a police report. Report the listing or account to PickleRush.',
        ],
      },
      {
        title: '8. Indemnification, governing law and changes',
        paragraphs: [
          'Anyone who breaches these documents or the law is liable for the damage they cause and, if PickleRush is charged or sued because of their act, must indemnify it, including reasonable defense costs.',
          `These documents are governed by Brazilian law. Where there is a consumer relationship, legal action may be brought in the courts of the consumer's place of residence. PickleRush may update these documents; material changes receive a new version and require new acceptance before using the Marketplace. Questions: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },

  'termos-comprador-mercado': {
    fonte: '938d343a',
    title: 'Buyer Terms',
    eyebrow: 'Marketplace · Buyers',
    description: 'The responsibilities of those who buy on the PickleRush Marketplace.',
    sections: [
      {
        title: '1. You decide and are responsible for your purchase',
        paragraphs: [
          'By buying on the Marketplace, you acknowledge that PickleRush only facilitates the meeting of interests between you and the seller, that it provides no service in the deal, and that it does not sell, deliver, receive payment for or guarantee the product.',
          'The decision to buy is yours. You take responsibility for assessing what you are buying and whom you are buying from: reading the entire listing, viewing all photos and videos (including the "AI-generated" label, when present), asking whatever you need before ordering, checking the seller\'s reviews and page, the delivery method, shipping, deadline and exchange and return policy, and verifying compatibility, size and authenticity when they matter.',
        ],
      },
      {
        title: '2. PickleRush disclaimer',
        paragraphs: [
          'To the fullest extent permitted by law, you release PickleRush from liability for the product and the deal, including defects, flaws, differences from the listing, counterfeiting, delay, loss, damage in transit, non-delivery and withdrawal by the seller. Complaints about the product, delivery, exchange, return, refund or warranty must be made to the seller.',
          'Your legal rights remain enforceable against the seller. If the seller is a supplier, you have the guarantees of the CDC (Brazil\'s Consumer Protection Code), including the right to withdraw within 7 days of receipt for purchases made online (art. 49) and the warranty against defects (arts. 18 and 26). Between private individuals, what was agreed and the Civil Code apply.',
        ],
      },
      {
        title: '3. Payment',
        bullets: [
          'Payment is made directly to the seller (usually by Pix, Brazil\'s instant payment system), and the key is shown after the seller accepts the order.',
          'Check the recipient\'s name before paying. Pay only the amount and to the key shown in the order.',
          'Since PickleRush does not receive the money, it does not reverse, refund, block or return any amounts. Refunds are always handled with the seller; in case of Pix fraud, contact your bank.',
          'Report in the order when you pay and keep the receipt.',
        ],
      },
      {
        title: '4. Receiving and picking up',
        bullets: [
          'Provide a correct and complete address when the item is shipped. A wrong address or absence at delivery is a matter to be resolved with the seller and the carrier.',
          'Inspect the product upon receipt; if there is a problem, document it with photos and notify the seller through the order as soon as possible, within the deadline shown there.',
          'Confirm receipt only when you have actually received the item. Confirmation completes the order.',
          'Pick-up meetings are arranged between you and the seller, at the risk of both.',
        ],
      },
      {
        title: '5. Buyer conduct',
        bullets: [
          'Place orders and offers only when you genuinely intend to buy, and pay within the agreed deadline.',
          'Use the seller\'s details (name, Pix key, pick-up location) only for this purchase.',
          'Review honestly and only about the purchase. Fake reviews, threats or blackmail involving reviews lead to suspension.',
          'Minors under 18 may only buy with the authorization and supervision of their legal guardian.',
        ],
      },
    ],
  },

  'termos-vendedor-mercado': {
    fonte: '98f4e5d4',
    title: 'Seller Terms',
    eyebrow: 'Marketplace · Sellers',
    description: 'The seller is solely and exclusively responsible for the product, the sale, shipping and documents.',
    sections: [
      {
        title: '1. Sole and exclusive responsibility of the seller',
        description: 'PickleRush takes no part in the sale; the seller is responsible for it.',
        bullets: [
          'The product: its existence, ownership or right to sell, lawful origin, authenticity, quality, condition, safety and compliance with the applicable standards (such as certifications required by law).',
          'The listing: title, description, features, condition, defects, price, shipping, deadlines, and photos and videos. The listing binds whoever publishes it (CDC — Brazil\'s Consumer Protection Code, arts. 30, 31 and 37).',
          'The sale: accepting or declining orders and offers, fulfilling what was agreed, receiving payment and checking that it actually arrived in your account.',
          'Exchanges, returns, refunds, warranty and customer service, including the right of withdrawal when you are a supplier.',
          'The taxes, licenses and tax and regulatory obligations of your activity.',
        ],
      },
      {
        title: '2. Shipping and delivery',
        bullets: [
          'The delivery method (shipping, pick-up or meeting) is offered and fulfilled by you. If the item is shipped, choosing, hiring and paying the carrier or the postal service (Correios), packaging, insurance, the tracking code and the deadline are your sole and exclusive responsibility.',
          'The risk of the product is yours until delivery to the buyer, except as you agree otherwise in writing and as permitted by law (Civil Code, art. 492).',
          'Respect the shipping restrictions for each product (for example, batteries and hazardous items).',
          'PickleRush does not recommend, hire or pay carriers and is not liable for them, nor for loss, damage or delay.',
        ],
      },
      {
        title: '3. Transaction documents',
        bullets: [
          'Invoices (nota fiscal), receipts, warranty certificates, manuals and other documents required by law are issued and delivered by you, when applicable.',
          'Shops, arenas and habitual sellers must clearly state their name or company name, CPF or CNPJ (Brazilian individual or company taxpayer ID), address and contact details, the essential features of the product, the total price including shipping, and the conditions of the offer, as required by Decree No. 7,962/2013 (e-commerce).',
          'Exchange and return conditions must be written on your page and comply with the law.',
        ],
      },
      {
        title: '4. What may not be sold',
        bullets: [
          'Counterfeit products, replicas or products that imitate third-party brands.',
          'Stolen or smuggled products, or products whose origin you cannot prove.',
          'Illegal, hazardous or recalled products, or products whose sale requires an authorization you do not have.',
          'Anything outside the world of sports, in addition to what the Community Guidelines and the law prohibit.',
        ],
      },
      {
        title: '5. Buyer data',
        paragraphs: [
          'The buyer\'s name, address and phone number are shown to you only after acceptance and may only be used to complete that sale. With respect to this data, you are an independent controller under the LGPD (Brazil\'s General Data Protection Law): you must store it securely, not share it, not use it for advertising without consent, and dispose of it when it is no longer needed.',
        ],
      },
      {
        title: '6. Waiver and indemnification',
        paragraphs: [
          'You release PickleRush from liability for complaints, charges, fines, citations and lawsuits related to your products, listings, sales, deliveries and documents, and you undertake to indemnify it, including reasonable defense costs, should it be charged or held liable because of your acts.',
          'Breaching these Terms may lead to removal of listings and suspension or termination of your sales and account, without prejudice to legal action.',
        ],
      },
    ],
  },

  'politica-imagens-ia-mercado': {
    fonte: 'c9b42e49',
    title: 'Policy on Images, Videos and AI-Generated Content',
    eyebrow: 'Marketplace · Photos and videos',
    description: 'What listing photos and videos must look like, and when to flag that they were generated or altered by artificial intelligence.',
    sections: [
      {
        title: '1. Photos and videos show the real product',
        bullets: [
          'Use photos and videos of the actual product that will be delivered, showing its condition, signs of use and defects.',
          'Catalog or manufacturer images may only be used for a new product identical to the one listed, and the description must state that the image is illustrative.',
          'Adjusting lighting, contrast, framing, size and rotation is allowed, as long as the product still looks as it really is.',
        ],
      },
      {
        title: '2. When to flag "Generated or altered by AI"',
        paragraphs: [
          'Check the option on the photo or video whenever it was created by artificial intelligence or altered by it in a way that changes what the buyer sees: the product assembled or "rendered", different colors, shape, size or accessories, defects removed, or the product placed in an AI-created setting. The platform shows the "AI-generated" label over the image, on the cards and in the enlarged photo.',
          'There is no need to flag simple adjustments that do not change the product, such as cropping, lighting, contrast, sharpness or a plain background in place of the original without altering the product itself.',
        ],
      },
      {
        title: '3. The declaration is yours',
        bullets: [
          'Whoever publishes declares whether the image or video was generated or altered by AI and is solely and exclusively responsible for the accuracy of that information and for the content published.',
          'PickleRush does not automatically analyze or certify images. The presence or absence of the label is not a guarantee given by the platform.',
          'AI-generated images may not be used to mislead the buyer about the product. Misleading advertising is prohibited by the CDC (Brazil\'s Consumer Protection Code, art. 37).',
        ],
      },
      {
        title: '4. What may not be published',
        bullets: [
          'Images or videos you do not hold the rights to (Law No. 9,610/1998, on copyright), such as photos from other sellers or from websites without authorization.',
          'Images of a person without their authorization (Civil Code, art. 20), and of an identifiable child or adolescent without the guardian\'s authorization.',
          'Montages that imitate real people (deepfakes), third-party brands on products that are not from that brand, and sexual, violent or discriminatory content.',
          'Visible personal data, such as documents, license plates, addresses and phone numbers.',
        ],
      },
      {
        title: '5. Measures and reports',
        paragraphs: [
          'Listings with misleading images, without the label when it was required, or that breach this policy may be paused or removed, and the account may be suspended. Anyone can report a listing using the report button.',
          'There is not yet a law in force in Brazil regulating the labeling of AI-generated content; this policy adopts transparency as good practice and will be updated when the legislation changes.',
        ],
      },
    ],
  },

  'termos-organizador': {
    fonte: 'fea3bd23',
    title: 'Tournament Organizer Terms',
    eyebrow: 'By role · Organizer',
    description: 'Responsibilities of those who create and manage tournaments on the platform.',
    sections: [
      {
        title: 'Responsibility for the event',
        paragraphs: [
          'By creating a tournament, you are responsible for its organization, rules, communication with registrants, refereeing, prizes and execution. PickleRush only provides the management tools.',
        ],
      },
      {
        title: 'Registrations, fees and registrant data',
        bullets: [
          'Registration fees are set and collected by you; the platform does not process payments.',
          'You access registrants\' data solely to manage your event and must process it in accordance with the LGPD (Brazil\'s General Data Protection Law).',
          'Using registrants\' data for purposes unrelated to the tournament is prohibited.',
        ],
      },
      {
        title: 'Integrity and conduct',
        paragraphs: [
          'You undertake to enter truthful results, treat participants equally and comply with the law and the rules of the sport. Fraud or abuse may lead to suspension of the tournament and the account.',
        ],
      },
    ],
  },

  'termos-arena': {
    fonte: 'fac5b370',
    title: 'Arena Owner Terms',
    eyebrow: 'By role · Arena',
    description: 'Responsibilities of those who register and manage arenas, courts, bookings and the shop.',
    sections: [
      {
        title: 'Accuracy and operation of the venue',
        paragraphs: [
          'You declare that you are entitled to register and operate the arena and its courts, and that the information (address, prices, hours, photos, rules) is true and up to date. The physical operation, safety and maintenance of the venue are your responsibility.',
        ],
      },
      {
        title: 'Bookings, prices and cancellations',
        bullets: [
          'You set the prices, availability and cancellation policy for your courts.',
          'Bookings and payments are confirmed by you; the platform does not process payments.',
          'You must honor confirmed bookings and communicate changes with reasonable notice.',
        ],
      },
      {
        title: 'Customers, data and compliance',
        paragraphs: [
          'Customer data accessed to manage bookings, memberships and the shop must be processed in accordance with the LGPD (Brazil\'s General Data Protection Law) and used only for that purpose. You are responsible for the tax and legal compliance of your operation.',
        ],
      },
    ],
  },

  'termos-professor': {
    fonte: '713aef07',
    title: 'Coach Terms',
    eyebrow: 'By role · Coach',
    description: 'Responsibilities of those who offer lessons, packages and clinics on the platform.',
    sections: [
      {
        title: 'Providing lessons',
        paragraphs: [
          'By registering as a coach, you declare that you are qualified and entitled to offer pickleball lessons. The teaching relationship is established directly between you and the student; PickleRush only facilitates the connection and scheduling.',
        ],
      },
      {
        title: 'Prices, packages and cancellations',
        bullets: [
          'Lesson prices, packages, credits and cancellation policy are set by you.',
          'Charges and refunds are handled directly with the student; the platform does not process payments.',
        ],
      },
      {
        title: 'Student data and conduct',
        paragraphs: [
          'Student records and progress notes must be kept confidential and processed in accordance with the LGPD (Brazil\'s General Data Protection Law), used only for teaching purposes. Lessons with minors require the consent of their guardians. You undertake to act ethically and safely.',
        ],
      },
    ],
  },
};
