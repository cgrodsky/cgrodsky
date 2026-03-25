import SwiftUI

struct GameView: View {
    @StateObject private var game = GameModel()
    @State private var dragStart: CGPoint?

    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Text("SNAKE")
                    .font(.system(size: 28, weight: .black, design: .monospaced))
                    .foregroundColor(.green)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Score: \(game.score)")
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                    Text("Best: \(game.highScore)")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal)

            // Game Board
            GeometryReader { geo in
                let size = min(geo.size.width, geo.size.height)
                let cellSize = size / CGFloat(GameModel.boardWidth)

                ZStack {
                    // Background
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.black)

                    // Grid lines (subtle)
                    Canvas { context, canvasSize in
                        let path = Path { p in
                            for i in 0...GameModel.boardWidth {
                                let x = CGFloat(i) * cellSize
                                p.move(to: CGPoint(x: x, y: 0))
                                p.addLine(to: CGPoint(x: x, y: size))
                            }
                            for i in 0...GameModel.boardHeight {
                                let y = CGFloat(i) * cellSize
                                p.move(to: CGPoint(x: 0, y: y))
                                p.addLine(to: CGPoint(x: size, y: y))
                            }
                        }
                        context.stroke(path, with: .color(.white.opacity(0.05)), lineWidth: 0.5)
                    }

                    // Food
                    Circle()
                        .fill(Color.red)
                        .frame(width: cellSize - 2, height: cellSize - 2)
                        .position(
                            x: CGFloat(game.food.x) * cellSize + cellSize / 2,
                            y: CGFloat(game.food.y) * cellSize + cellSize / 2
                        )

                    // Snake
                    ForEach(Array(game.snake.enumerated()), id: \.offset) { index, segment in
                        let isHead = index == 0
                        RoundedRectangle(cornerRadius: isHead ? cellSize * 0.3 : cellSize * 0.15)
                            .fill(isHead ? Color.green : Color.green.opacity(0.7 - Double(index) * 0.015))
                            .frame(width: cellSize - 1, height: cellSize - 1)
                            .position(
                                x: CGFloat(segment.x) * cellSize + cellSize / 2,
                                y: CGFloat(segment.y) * cellSize + cellSize / 2
                            )
                    }

                    // Game Over overlay
                    if game.isGameOver {
                        VStack(spacing: 12) {
                            Text("GAME OVER")
                                .font(.system(size: 32, weight: .black, design: .monospaced))
                                .foregroundColor(.red)
                            Text("Score: \(game.score)")
                                .font(.system(size: 20, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                            Text("Tap to play again")
                                .font(.system(size: 14, design: .monospaced))
                                .foregroundColor(.gray)
                        }
                        .padding(24)
                        .background(Color.black.opacity(0.85))
                        .cornerRadius(16)
                    }

                    // Start prompt
                    if !game.isRunning && !game.isGameOver {
                        VStack(spacing: 8) {
                            Text("SNAKE")
                                .font(.system(size: 36, weight: .black, design: .monospaced))
                                .foregroundColor(.green)
                            Text("Tap to start")
                                .font(.system(size: 16, design: .monospaced))
                                .foregroundColor(.gray)
                            Text("Swipe to change direction")
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.gray.opacity(0.7))
                        }
                        .padding(24)
                        .background(Color.black.opacity(0.85))
                        .cornerRadius(16)
                    }
                }
                .frame(width: size, height: size)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .aspectRatio(1, contentMode: .fit)
            .gesture(
                DragGesture(minimumDistance: 10)
                    .onEnded { value in
                        let dx = value.translation.width
                        let dy = value.translation.height
                        if abs(dx) > abs(dy) {
                            game.changeDirection(dx > 0 ? .right : .left)
                        } else {
                            game.changeDirection(dy > 0 ? .down : .up)
                        }
                    }
            )
            .onTapGesture {
                if game.isGameOver || !game.isRunning {
                    game.start()
                }
            }

            // Controls (for keyboard / button fallback)
            VStack(spacing: 8) {
                Button(action: { game.changeDirection(.up) }) {
                    Image(systemName: "chevron.up")
                        .font(.title2.bold())
                        .frame(width: 56, height: 44)
                }
                HStack(spacing: 40) {
                    Button(action: { game.changeDirection(.left) }) {
                        Image(systemName: "chevron.left")
                            .font(.title2.bold())
                            .frame(width: 56, height: 44)
                    }
                    Button(action: { game.changeDirection(.down) }) {
                        Image(systemName: "chevron.down")
                            .font(.title2.bold())
                            .frame(width: 56, height: 44)
                    }
                    Button(action: { game.changeDirection(.right) }) {
                        Image(systemName: "chevron.right")
                            .font(.title2.bold())
                            .frame(width: 56, height: 44)
                    }
                }
            }
            .buttonStyle(.bordered)
            .tint(.green)

            // Pause button
            if game.isRunning {
                Button(action: { game.pause() }) {
                    Label("Pause", systemImage: "pause.fill")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                }
                .buttonStyle(.bordered)
                .tint(.orange)
            }
        }
        .padding()
        .background(Color(white: 0.1))
        .onKeyPress(.upArrow) { game.changeDirection(.up); return .handled }
        .onKeyPress(.downArrow) { game.changeDirection(.down); return .handled }
        .onKeyPress(.leftArrow) { game.changeDirection(.left); return .handled }
        .onKeyPress(.rightArrow) { game.changeDirection(.right); return .handled }
        .onKeyPress(" ") {
            if game.isGameOver || !game.isRunning { game.start() }
            else { game.pause() }
            return .handled
        }
    }
}

#Preview {
    GameView()
}
