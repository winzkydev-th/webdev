# AC-11 Restore Verification Evidence
Run: 10 พฤศจิกายน 2569 เวลา 19:09:57 (Asia/Bangkok)
Source unchanged: true. Restore destinations: separate physical PostgreSQL cluster; two distinct new databases. Source/target clusters stopped after completion.

| Table | Source rows | Restore 1 rows | Restore 2 rows | Full-row SHA256 |
|---|---:|---:|---:|---|
| attachment_upload_permits | 1 | 1 | 1 | 7584bf787f49fc0daa3ffd50f2925afc80b5f943b396f695115a649006158b2c |
| attachments | 4 | 4 | 4 | 71f41d5b15d65ad18d1494ebacb289124422f7ca11fc18eeffa4622ce4c455d6 |
| audit_logs | 5 | 5 | 5 | 1009655c48da758519e6592eeb0f93def6b13aa1bc0f407adc713b0be8dae767 |
| cms_events | 3 | 3 | 3 | 5b3c936ba0797bcfe8cf2b63e64e1e90fc3df179d40d3a8a8d7ae13876260e0d |
| cms_revisions | 3 | 3 | 3 | 3e0cff0f353d4ff8e955b56179710ef15055f78b4df6d9e88e8fe972e40e058e |
| contacts | 4 | 4 | 4 | cffdce9c77cefc46882dfd9a6f3dde8ca908e5c34aff3a854721776d513deba7 |
| customers | 1 | 1 | 1 | 20fe7abecbaafb4d2a2ac516a825313fb962ffed21a8813530f00833869f2e72 |
| intake_rate_limits | 5 | 5 | 5 | a520afd7a4af9f743a1c87dbdba79d03824d9dfac5d6327693c71c42233a58ff |
| media | 1 | 1 | 1 | 226b93d3f3dcb84d2c0e498a954986f3961b3644dc79172734fa29ca101b39ae |
| notification_attempts | 1 | 1 | 1 | ed67e3cc3ce44af152bba0940e9c1051efd7186e489dc5d4024bc1bafcd187a9 |
| notifications | 8 | 8 | 8 | 6baea38b449059888f2c6e451b5cd0b6ae8562783919165d7a1feadaa164350f |
| pages | 12 | 12 | 12 | 0d30684840c2d37c8f5bf8fd9d79a38a3314dc607b770dd0d7d7c7b8bc600fe2 |
| quotation_deliveries | 1 | 1 | 1 | c9471108fd0bd5755609071ddf810fad4240eaeff2cb866bd6228ca56f33c125 |
| quotation_documents | 1 | 1 | 1 | 6bccc7654fabfba541e3da7ecb836722f80d93a9aea7c9b3f421fb22d506cdd2 |
| quote_activities | 1 | 1 | 1 | 539adda6c9524a86ad976f1b70d35ab9982ccf8ec18fb285ecd2c399e667ec2c |
| quote_assignments | 1 | 1 | 1 | 2e853fac9526ab7a652c06d50ce1787b29843ab81e3bf569dff1e1fcfb3990ef |
| quote_cargo_details | 4 | 4 | 4 | 20e504e835ce2d4005ed4af67bcf64801b3b6f9787ca221018857503f59bb3f3 |
| quote_offers | 1 | 1 | 1 | 217d9e658749029a80aaf3057a43bef87b2b65d67e8c86f26e57af6acd8ba9b4 |
| quote_requests | 4 | 4 | 4 | c2c22d572dc19596c5080624bb79b4cf6e299088c3a98db11120d40ecef0cce6 |
| quote_revisions | 1 | 1 | 1 | 9175e0392e53de7992373aed59c063c7054dd48007b54c636d1d52f1c08d608f |
| quote_status_history | 8 | 8 | 8 | 2b1f316997bc6b31b7efdcfc21cfa6fd9ceeaa20fc931d4f6bea32b3a2523d9a |
| schema_migrations | 8 | 8 | 8 | 8e7211e415ea1b064ca538d6ecdb79123ca0994edef3e771edde101fe0c51ab4 |
| staff_login_transactions | 1 | 1 | 1 | 8a881cc01bf0130706bf14c8068b836ac59ab696d1b7b5543fcc25e14415fb04 |
| staff_sessions | 1 | 1 | 1 | d905c396d2ea9c51f6a14868fc706ae32fba8a413944507c0aec7dc1b3d246d4 |
| staff_users | 5 | 5 | 5 | 9ac427ed2f221b25623c2b71ffc3992c320a4681cad0fdc9dcde496dc03ebc54 |
| system_settings | 1 | 1 | 1 | 78dfe80a80f91029b89f149c30dbb6f9714c35f4482a753b72cc13a0dfd045e1 |
| translations | 3 | 3 | 3 | 54ea24655045e30fc6ecfa4807cbb4c8d3c1036ce1323ae8da6c62ee43ba745b |

## Schema fingerprints — source and both restores match
- columns: 04e5e06958b38e6d6e12cb76aaf52704ff272b22074e20dcaa3232ab4639e88f
- constraints: af60b79b62190c7e37576d85c2c7212ddf5b319b54d419879d9fe5ffa560837f
- functions: 880ffde427de38883701a1dd738708052b3f8b71b2fa34e1efdd111e88f0bc67
- triggers: b87f2b0ea6d9b8d540c72397a3dd728a9c1edf796df1933f11c052d1cee84094
- indexes: 8b31177660ba2c7bede9d32a77c3c5359afa34582992d9c9a1cd43e4742eb447
- views: d2b1af236b21178fa08a329484fd5ce96abcc91cb37021be83e124cbf3ed1303

## Actual restored objects
All 5 files were decrypted and checked against size and SHA256 before acceptance (4 attachments including quarantine + 1 media object).

| Object key | Bytes | SHA256 |
|---|---:|---|
| 470d59dd-fbe3-43cf-bcde-41dec2a3b094 | 45 | 5edbb12f301936937351beb71059fdf9e26c80f001fa23294196e98ec706d533 |
| 49dd6931-c529-4dbb-8453-4ce9d7e12581 | 45 | 5820652b96d61f93760f67d148dcaeed4426035c195fe911a0bf2b0642f0ce85 |
| 9d4bb30b-017a-4fce-9709-2c262a41c820 | 45 | d5cf3ce870975aaf81974d3ef0c656bb267b9c143c12f061e6977b63d0509435 |
| 9f8819f8-69fa-4473-ba61-94ba0b6f95d5 | 20 | 138f48a14d413565d5e0522cf82b6e54a611d74d8eead0406e8beafe0b55b3be |
| ba26028f-15c6-4288-896b-b21117dbd092 | 45 | ed2c422419e0f1389312a795d5200ce42511c0a9578e568d841e666a2ecf19db |

Sequence restored exactly: {"quote_reference_seq":{"last_value":"4","is_called":true}}. Next reference in the second restored test database was 5. The source sequence was unchanged. Latest quotation delivery proof resolved true; 3 published test CMS languages retained; no unvalidated constraints; restored append-only audit/CMS triggers rejected modification.

Raw machine-readable evidence: AC-11-restore-evidence.json. It contains measured values and hashes, no raw customer records or keys. This was entirely new synthetic data, not Production.
