//
//  ViewController.swift
//  RDemoUI1
//
//  Created by Ihor Malovanyi on 01.02.2023.
//

import UIKit

final class ViewController: UIViewController {

    private var lock = NSRecursiveLock()
    private var countOfBoxes = 0
    
    private var flowLayout: UICollectionViewFlowLayout = {
        let result = UICollectionViewFlowLayout()
        result.itemSize = .init(width: 150, height: 150)
        result.scrollDirection = .horizontal
        return result
    }()
    
    private lazy var collectionView = UICollectionView(frame: .zero, collectionViewLayout: flowLayout)
    private var button = UIButton()
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupCollection()
        setupButton()
    }
    
    private func setupCollection() {
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(UICollectionViewCell.self, forCellWithReuseIdentifier: "Cell")
        collectionView.backgroundColor = .red
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.leftAnchor.constraint(equalTo: view.leftAnchor),
            collectionView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            collectionView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            collectionView.heightAnchor.constraint(equalToConstant: 200)
        ])
        collectionView.reloadData()
    }
    
    private func setupButton() {
        button.setTitle("Add one", for: .normal)
        button.setTitleColor(.red, for: .normal)
        button.addTarget(self, action: #selector(addOneAction), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            button.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])
    }
    
    @objc private func addOneAction() {
        add()
    }
    
}

//MARK: - API
extension ViewController {
    
    func add() {
        DispatchQueue.main.async {
            self.countOfBoxes += 1
            self.collectionView.insertItems(at: [.init(row: self.countOfBoxes - 1, section: 0)])
            self.collectionView.scrollToItem(at: .init(row: self.countOfBoxes - 1, section: 0), at: .right, animated: true)
        }
    }
    
    func delete(at index: Int) {
        DispatchQueue.main.async {
            self.countOfBoxes -= 1
            UIView.animate(withDuration: 0.5) {
                self.collectionView.deleteItems(at: [.init(row: index, section: 0)])
            }
        }
    }
    
}

extension ViewController: UICollectionViewDataSource, UICollectionViewDelegate {
    
    func numberOfSections(in collectionView: UICollectionView) -> Int {
        1
    }
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        countOfBoxes
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "Cell", for: indexPath)
        cell.contentView.backgroundColor = .black
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        delete(at: indexPath.row)
    }
    
}
