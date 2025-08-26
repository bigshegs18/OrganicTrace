;; BatchCreator.clar
;; Core contract for creating and managing produce batch NFTs in OrganicTrace
;; This contract handles the minting of unique NFTs representing organic produce batches,
;; ensuring immutability and traceability. It integrates with RoleManager for access control.
;; Expanded with features for ownership transfer, status updates, metadata versioning,
;; collaborator management, category tagging, and basic revenue sharing for supply chain participants.

;; NFT Definition
(define-non-fungible-token produce-batch uint)

;; Data Maps
(define-map batches
  { batch-id: uint }
  {
    farm-id: principal,          ;; Principal of the registered farm
    crop-type: (string-ascii 50), ;; Type of crop (e.g., "Tomatoes", "Apples")
    harvest-date: uint,           ;; Block height or timestamp of harvest
    batch-hash: (buff 32),        ;; SHA-256 hash of batch details for integrity
    creator: principal,           ;; Original creator (farmer)
    created-at: uint,             ;; Block height of creation
    current-owner: principal,     ;; Current owner (updates on transfer)
    metadata: (string-utf8 500)   ;; Additional JSON-like metadata
  }
)

(define-map batch-versions
  { batch-id: uint, version: uint }
  {
    updated-hash: (buff 32),
    update-notes: (string-utf8 200),
    timestamp: uint
  }
)

(define-map batch-licenses
  { batch-id: uint, licensee: principal }
  {
    expiry: uint,
    terms: (string-utf8 200),
    active: bool
  }
)

(define-map batch-categories
  { batch-id: uint }
  {
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20))
  }
)

(define-map batch-collaborators
  { batch-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),
    permissions: (list 5 (string-utf8 20)),
    added-at: uint
  }
)

(define-map batch-status
  { batch-id: uint }
  {
    status: (string-utf8 20),  ;; e.g., "Harvested", "Shipped", "Sold"
    visibility: bool,          ;; Public or private visibility
    last-updated: uint
  }
)

(define-map batch-revenue-shares
  { batch-id: uint, participant: principal }
  {
    percentage: uint,  ;; 0-100
    total-received: uint
  }
)

;; Constants for Errors
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-INVALID-HASH (err u101))
(define-constant ERR-BATCH-EXISTS (err u102))
(define-constant ERR-INVALID-ID (err u103))
(define-constant ERR-NOT-OWNER (err u104))
(define-constant ERR-INVALID-PARAM (err u105))
(define-constant ERR-ALREADY-REGISTERED (err u106))
(define-constant ERR-METADATA-TOO-LONG (err u107))
(define-constant ERR-INVALID-PERCENTAGE (err u108))
(define-constant ERR-EXPIRED (err u109))

;; Variables
(define-data-var batch-counter uint u0)
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var max-metadata-len uint u500)

;; Private Functions
(define-private (is-authorized-caller (caller principal))
  ;; Placeholder for RoleManager integration: Assume farmers are authorized
  (or (is-eq caller tx-sender) (is-eq caller (var-get admin)))
)

(define-private (increment-counter)
  (let ((current (var-get batch-counter)))
    (var-set batch-counter (+ current u1))
    (+ current u1)
  )
)

;; Public Functions

(define-public (create-batch
  (farm-id principal)
  (crop-type (string-ascii 50))
  (harvest-date uint)
  (batch-hash (buff 32))
  (metadata (string-utf8 500)))
  (let
    (
      (batch-id (increment-counter))
      (existing (map-get? batches {batch-id: batch-id}))
    )
    (asserts! (not (var-get paused)) ERR-UNAUTHORIZED)  ;; Check if paused
    (asserts! (is-authorized-caller tx-sender) ERR-UNAUTHORIZED)
    (asserts! (is-none existing) ERR-BATCH-EXISTS)
    (asserts! (> (len batch-hash) u0) ERR-INVALID-HASH)
    (asserts! (<= (len metadata) (var-get max-metadata-len)) ERR-METADATA-TOO-LONG)
    (try! (nft-mint? produce-batch batch-id tx-sender))
    (map-set batches
      {batch-id: batch-id}
      {
        farm-id: farm-id,
        crop-type: crop-type,
        harvest-date: harvest-date,
        batch-hash: batch-hash,
        creator: tx-sender,
        created-at: block-height,
        current-owner: tx-sender,
        metadata: metadata
      }
    )
    (print {event: "batch-created", batch-id: batch-id, creator: tx-sender})
    (ok batch-id)
  )
)

(define-public (transfer-ownership (batch-id uint) (new-owner principal))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
      (current-owner (get current-owner batch))
    )
    (asserts! (is-eq tx-sender current-owner) ERR-NOT-OWNER)
    (try! (nft-transfer? produce-batch batch-id tx-sender new-owner))
    (map-set batches
      {batch-id: batch-id}
      (merge batch {current-owner: new-owner})
    )
    (print {event: "ownership-transferred", batch-id: batch-id, from: tx-sender, to: new-owner})
    (ok true)
  )
)

(define-public (register-new-version
  (batch-id uint)
  (new-hash (buff 32))
  (version uint)
  (notes (string-utf8 200)))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? batch-versions {batch-id: batch-id, version: version})) ERR-ALREADY-REGISTERED)
    (map-set batch-versions
      {batch-id: batch-id, version: version}
      {
        updated-hash: new-hash,
        update-notes: notes,
        timestamp: block-height
      }
    )
    (print {event: "version-registered", batch-id: batch-id, version: version})
    (ok true)
  )
)

(define-public (grant-license
  (batch-id uint)
  (licensee principal)
  (duration uint)
  (terms (string-utf8 200)))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (map-set batch-licenses
      {batch-id: batch-id, licensee: licensee}
      {
        expiry: (+ block-height duration),
        terms: terms,
        active: true
      }
    )
    (print {event: "license-granted", batch-id: batch-id, licensee: licensee})
    (ok true)
  )
)

(define-public (revoke-license (batch-id uint) (licensee principal))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
      (license (map-get? batch-licenses {batch-id: batch-id, licensee: licensee}))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (asserts! (is-some license) ERR-INVALID-ID)
    (map-set batch-licenses
      {batch-id: batch-id, licensee: licensee}
      (merge (unwrap! license ERR-INVALID-ID) {active: false})
    )
    (print {event: "license-revoked", batch-id: batch-id, licensee: licensee})
    (ok true)
  )
)

(define-public (add-category
  (batch-id uint)
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20))))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (map-set batch-categories
      {batch-id: batch-id}
      {category: category, tags: tags}
    )
    (print {event: "category-added", batch-id: batch-id})
    (ok true)
  )
)

(define-public (add-collaborator
  (batch-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20))))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? batch-collaborators {batch-id: batch-id, collaborator: collaborator})) ERR-ALREADY-REGISTERED)
    (map-set batch-collaborators
      {batch-id: batch-id, collaborator: collaborator}
      {
        role: role,
        permissions: permissions,
        added-at: block-height
      }
    )
    (print {event: "collaborator-added", batch-id: batch-id, collaborator: collaborator})
    (ok true)
  )
)

(define-public (update-status
  (batch-id uint)
  (status (string-utf8 20))
  (visibility bool))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (map-set batch-status
      {batch-id: batch-id}
      {
        status: status,
        visibility: visibility,
        last-updated: block-height
      }
    )
    (print {event: "status-updated", batch-id: batch-id, status: status})
    (ok true)
  )
)

(define-public (set-revenue-share
  (batch-id uint)
  (participant principal)
  (percentage uint))
  (let
    (
      (batch (unwrap! (map-get? batches {batch-id: batch-id}) ERR-INVALID-ID))
    )
    (asserts! (is-eq tx-sender (get current-owner batch)) ERR-NOT-OWNER)
    (asserts! (and (> percentage u0) (<= percentage u100)) ERR-INVALID-PERCENTAGE)
    (map-set batch-revenue-shares
      {batch-id: batch-id, participant: participant}
      {
        percentage: percentage,
        total-received: u0
      }
    )
    (print {event: "revenue-share-set", batch-id: batch-id, participant: participant})
    (ok true)
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-UNAUTHORIZED)
    (var-set paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) ERR-UNAUTHORIZED)
    (var-set paused false)
    (ok true)
  )
)

;; Read-Only Functions

(define-read-only (get-batch-details (batch-id uint))
  (map-get? batches {batch-id: batch-id})
)

(define-read-only (get-batch-version (batch-id uint) (version uint))
  (map-get? batch-versions {batch-id: batch-id, version: version})
)

(define-read-only (get-batch-license (batch-id uint) (licensee principal))
  (let
    (
      (license (map-get? batch-licenses {batch-id: batch-id, licensee: licensee}))
    )
    (match license l
      (if (> (get expiry l) block-height)
        (some l)
        none
      )
      none
    )
  )
)

(define-read-only (get-batch-category (batch-id uint))
  (map-get? batch-categories {batch-id: batch-id})
)

(define-read-only (get-batch-collaborator (batch-id uint) (collaborator principal))
  (map-get? batch-collaborators {batch-id: batch-id, collaborator: collaborator})
)

(define-read-only (get-batch-status (batch-id uint))
  (map-get? batch-status {batch-id: batch-id})
)

(define-read-only (get-batch-revenue-share (batch-id uint) (participant principal))
  (map-get? batch-revenue-shares {batch-id: batch-id, participant: participant})
)

(define-read-only (get-batch-owner (batch-id uint))
  (nft-get-owner? produce-batch batch-id)
)

(define-read-only (is-paused)
  (var-get paused)
)

(define-read-only (get-counter)
  (var-get batch-counter)
)