package services

import (
	"log"
	"math/rand"
	"time"
)

type QueueJob struct {
	InstanceName string
	Number       string
	Message      string
	Retries      int
}

type WhatsAppQueueService struct {
	waService *WhatsAppService
	jobQueue  chan QueueJob
}

func NewWhatsAppQueueService(waService *WhatsAppService) *WhatsAppQueueService {
	return &WhatsAppQueueService{
		waService: waService,
		jobQueue:  make(chan QueueJob, 1000),
	}
}

// StartWorker launches the sequentially enqueued background worker goroutine
func (q *WhatsAppQueueService) StartWorker() {
	go q.workerLoop()
}

// Enqueue adds a job to the thread-safe buffered channel queue
func (q *WhatsAppQueueService) Enqueue(instance string, number string, message string) {
	q.jobQueue <- QueueJob{
		InstanceName: instance,
		Number:       number,
		Message:      message,
		Retries:      0,
	}
}

func (q *WhatsAppQueueService) workerLoop() {
	log.Println("[WhatsAppQueueWorker] Background worker started successfully.")
	
	for job := range q.jobQueue {
		// 1. Simular Typing (Presencia Composing)
		log.Printf("[WhatsAppQueueWorker] Activating composing presence for %s", job.Number)
		_ = q.waService.SendPresence(job.InstanceName, job.Number, "composing")
		
		// 2. Delay escribiendo (2 a 5 segundos)
		typingDelay := randomRange(2, 5)
		time.Sleep(time.Duration(typingDelay) * time.Second)
		
		// 3. Enviar el mensaje
		log.Printf("[WhatsAppQueueWorker] Dispatching message to %s", job.Number)
		_, err := q.waService.SendText(job.InstanceName, job.Number, job.Message)
		
		if err != nil {
			log.Printf("[WhatsAppQueueWorker] Error sending to %s: %v", job.Number, err)
			
			// Reintento si no supera el límite de 3
			if job.Retries < 3 {
				job.Retries++
				// Backoff de error: espera de 30 a 60 segundos antes de reintentar
				errorDelay := randomRange(30, 60)
				log.Printf("[WhatsAppQueueWorker] Backing off for %d seconds before rescheduling...", errorDelay)
				time.Sleep(time.Duration(errorDelay) * time.Second)
				
				// Re-encolar
				q.jobQueue <- job
			}
			continue
		}
		
		// 4. Delay entre contactos (15 a 20 segundos) para simular comportamiento humano
		contactDelay := randomRange(15, 20)
		log.Printf("[WhatsAppQueueWorker] Success. Pausing for %d seconds to prevent ban...", contactDelay)
		time.Sleep(time.Duration(contactDelay) * time.Second)
	}
}

func randomRange(min, max int) int {
	rand.Seed(time.Now().UnixNano())
	return rand.Intn(max-min+1) + min
}
