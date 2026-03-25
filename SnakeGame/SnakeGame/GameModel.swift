import Foundation
import Combine

class GameModel: ObservableObject {
    static let boardWidth = 20
    static let boardHeight = 20

    @Published var snake: [Position] = []
    @Published var food: Position = Position(x: 0, y: 0)
    @Published var score: Int = 0
    @Published var isGameOver: Bool = false
    @Published var isRunning: Bool = false
    @Published var highScore: Int = 0

    var direction: Direction = .right
    private var pendingDirection: Direction = .right
    private var timer: AnyCancellable?
    private var speed: TimeInterval = 0.15

    init() {
        reset()
    }

    func reset() {
        let midX = Self.boardWidth / 2
        let midY = Self.boardHeight / 2
        snake = [
            Position(x: midX, y: midY),
            Position(x: midX - 1, y: midY),
            Position(x: midX - 2, y: midY)
        ]
        direction = .right
        pendingDirection = .right
        score = 0
        isGameOver = false
        speed = 0.15
        spawnFood()
    }

    func start() {
        if isGameOver {
            reset()
        }
        isRunning = true
        startTimer()
    }

    func pause() {
        isRunning = false
        timer?.cancel()
        timer = nil
    }

    func changeDirection(_ newDirection: Direction) {
        // Prevent reversing into yourself
        if newDirection.opposite != direction {
            pendingDirection = newDirection
        }
    }

    private func startTimer() {
        timer?.cancel()
        timer = Timer.publish(every: speed, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.tick()
            }
    }

    private func tick() {
        guard isRunning, !isGameOver else { return }

        direction = pendingDirection

        let head = snake[0]
        let newHead = Position(
            x: head.x + direction.delta.x,
            y: head.y + direction.delta.y
        )

        // Wall collision
        if newHead.x < 0 || newHead.x >= Self.boardWidth ||
           newHead.y < 0 || newHead.y >= Self.boardHeight {
            gameOver()
            return
        }

        // Self collision
        if snake.contains(newHead) {
            gameOver()
            return
        }

        snake.insert(newHead, at: 0)

        if newHead == food {
            score += 10
            spawnFood()
            // Speed up slightly every 50 points
            if score % 50 == 0 && speed > 0.06 {
                speed -= 0.01
                startTimer()
            }
        } else {
            snake.removeLast()
        }
    }

    private func spawnFood() {
        var candidates = Set<Position>()
        for x in 0..<Self.boardWidth {
            for y in 0..<Self.boardHeight {
                candidates.insert(Position(x: x, y: y))
            }
        }
        candidates.subtract(snake)
        if let pos = candidates.randomElement() {
            food = pos
        }
    }

    private func gameOver() {
        isGameOver = true
        isRunning = false
        timer?.cancel()
        timer = nil
        if score > highScore {
            highScore = score
        }
    }
}
