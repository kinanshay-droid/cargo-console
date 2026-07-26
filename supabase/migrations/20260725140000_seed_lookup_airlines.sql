-- Seed lookup_airlines with cargo airlines relevant to pharma/life-science
-- shipments (base country, activity type, pharma-fit rating in metadata).
-- Requested by the user to populate the "חברת תעופה" (airline) picker.

INSERT INTO public.lookup_airlines (code, name, name_en, sort_order, metadata) VALUES
  ('EL_AL_CARGO', 'EL AL Cargo', 'EL AL Cargo', 1, '{"country": "ישראל", "activity_type": "Freighter + Belly", "pharma_rating": 5}'),
  ('CHALLENGE_AIRLINES_IL', 'Challenge Airlines Israel (CAL)', 'Challenge Airlines Israel (CAL)', 2, '{"country": "ישראל", "activity_type": "Freighter", "pharma_rating": 5}'),
  ('LUFTHANSA_CARGO', 'Lufthansa Cargo', 'Lufthansa Cargo', 3, '{"country": "גרמניה", "activity_type": "Freighter + Belly", "pharma_rating": 5}'),
  ('DHL_AVIATION_EAT', 'DHL Aviation / European Air Transport', 'DHL Aviation / European Air Transport', 4, '{"country": "גרמניה", "activity_type": "Express Cargo", "pharma_rating": 5}'),
  ('FEDEX_EXPRESS', 'FedEx Express', 'FedEx Express', 5, '{"country": "ארה״ב", "activity_type": "Express Cargo", "pharma_rating": 5}'),
  ('ETHIOPIAN_CARGO', 'Ethiopian Cargo', 'Ethiopian Cargo', 6, '{"country": "אתיופיה", "activity_type": "Freighter + Belly", "pharma_rating": 5}'),
  ('TURKISH_CARGO', 'Turkish Cargo', 'Turkish Cargo', 7, '{"country": "טורקיה", "activity_type": "Freighter + Belly", "pharma_rating": 5}'),
  ('EMIRATES_SKYCARGO', 'Emirates SkyCargo', 'Emirates SkyCargo', 8, '{"country": "איחוד האמירויות", "activity_type": "Belly + Freighter (לפי זמינות)", "pharma_rating": 5}'),
  ('QATAR_AIRWAYS_CARGO', 'Qatar Airways Cargo', 'Qatar Airways Cargo', 9, '{"country": "קטר", "activity_type": "Cargo", "pharma_rating": 5}'),
  ('ETIHAD_CARGO', 'Etihad Cargo', 'Etihad Cargo', 10, '{"country": "איחוד האמירויות", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('AIR_FRANCE_CARGO', 'Air France Cargo', 'Air France Cargo', 11, '{"country": "צרפת", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('KLM_CARGO', 'KLM Cargo', 'KLM Cargo', 12, '{"country": "הולנד", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('UNITED_CARGO', 'United Cargo', 'United Cargo', 13, '{"country": "ארה״ב", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('DELTA_CARGO', 'Delta Cargo', 'Delta Cargo', 14, '{"country": "ארה״ב", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('AMERICAN_AIRLINES_CARGO', 'American Airlines Cargo', 'American Airlines Cargo', 15, '{"country": "ארה״ב", "activity_type": "Belly Cargo", "pharma_rating": 3}'),
  ('HAINAN_AIRLINES_CARGO', 'Hainan Airlines Cargo', 'Hainan Airlines Cargo', 16, '{"country": "סין", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('KOREAN_AIR_CARGO', 'Korean Air Cargo', 'Korean Air Cargo', 17, '{"country": "קוריאה הדרומית", "activity_type": "Freighter + Belly", "pharma_rating": 5}'),
  ('SILK_WAY_WEST', 'Silk Way West Airlines', 'Silk Way West Airlines', 18, '{"country": "אזרבייג׳ן", "activity_type": "Freighter", "pharma_rating": 5}'),
  ('ATLAS_AIR', 'Atlas Air', 'Atlas Air', 19, '{"country": "ארה״ב", "activity_type": "Freighter Charter", "pharma_rating": 5}'),
  ('NATIONAL_AIRLINES', 'National Airlines', 'National Airlines', 20, '{"country": "ארה״ב", "activity_type": "Freighter", "pharma_rating": 5}'),
  ('CARGOAIR', 'Cargoair', 'Cargoair', 21, '{"country": "בולגריה", "activity_type": "Freighter", "pharma_rating": 4}'),
  ('MY_FREIGHTER', 'My Freighter', 'My Freighter', 22, '{"country": "אוזבקיסטן", "activity_type": "Freighter", "pharma_rating": 4}'),
  ('KALITTA_AIR', 'Kalitta Air', 'Kalitta Air', 23, '{"country": "ארה״ב", "activity_type": "Freighter", "pharma_rating": 5}'),
  ('ASL_AIRLINES_BELGIUM', 'ASL Airlines Belgium', 'ASL Airlines Belgium', 24, '{"country": "בלגיה", "activity_type": "Freighter", "pharma_rating": 4}'),
  ('GEORGIAN_AIRWAYS_CARGO', 'Georgian Airways Cargo', 'Georgian Airways Cargo', 25, '{"country": "גאורגיה", "activity_type": "Cargo", "pharma_rating": 3}'),
  ('FLYDUBAI_CARGO', 'Flydubai Cargo', 'Flydubai Cargo', 26, '{"country": "איחוד האמירויות", "activity_type": "Belly Cargo", "pharma_rating": 4}'),
  ('ROYAL_JORDANIAN_CARGO', 'Royal Jordanian Cargo', 'Royal Jordanian Cargo', 27, '{"country": "ירדן", "activity_type": "Belly Cargo", "pharma_rating": 3}'),
  ('AZERBAIJAN_AIRLINES_CARGO', 'Azerbaijan Airlines Cargo', 'Azerbaijan Airlines Cargo', 28, '{"country": "אזרבייג׳ן", "activity_type": "Belly Cargo", "pharma_rating": 4}');
