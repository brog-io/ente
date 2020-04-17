import 'dart:collection';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:logger/logger.dart';
import 'package:myapp/models/photo.dart';
import 'package:myapp/photo_loader.dart';
import 'package:myapp/ui/image_widget.dart';
import 'package:myapp/utils/date_time_util.dart';
import 'package:provider/provider.dart';

import 'detail_page.dart';

class Gallery extends StatefulWidget {
  final List<Photo> photos;
  _GalleryState _state;
  Function(Set<Photo>) photoSelectionChangeCallback;

  Gallery(this.photos, {this.photoSelectionChangeCallback});

  @override
  _GalleryState createState() {
    _state = _GalleryState();
    return _state;
  }
}

class _GalleryState extends State<Gallery> {
  final ScrollController _scrollController = ScrollController();
  final List<List<Photo>> _collatedPhotos = List<List<Photo>>();
  final Set<Photo> _selectedPhotos = HashSet<Photo>();
  PhotoLoader get photoLoader => Provider.of<PhotoLoader>(context);
  bool _shouldSelectOnTap = false;

  @override
  Widget build(BuildContext context) {
    _collatePhotos();

    return ListView.builder(
      itemCount: _collatedPhotos.length,
      itemBuilder: _buildListItem,
      controller: _scrollController,
    );
  }

  Widget _buildListItem(BuildContext context, int index) {
    var photos = _collatedPhotos[index];
    return Column(
      children: <Widget>[
        _getDay(photos[0].createTimestamp),
        _getGallery(photos)
      ],
    );
  }

  Widget _getDay(int timestamp) {
    return Container(
      padding: const EdgeInsets.all(8.0),
      alignment: Alignment.centerLeft,
      child: Text(
        getDayAndMonth(DateTime.fromMicrosecondsSinceEpoch(timestamp)),
        style: TextStyle(fontSize: 16),
      ),
    );
  }

  Widget _getGallery(List<Photo> photos) {
    return GridView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.only(bottom: 12),
      physics: ScrollPhysics(), // to disable GridView's scrolling
      itemBuilder: (context, index) {
        return _buildPhoto(context, photos[index]);
      },
      itemCount: photos.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
      ),
    );
  }

  Widget _buildPhoto(BuildContext context, Photo photo) {
    return GestureDetector(
      onTap: () {
        if (_shouldSelectOnTap) {
          _selectPhoto(photo);
        } else {
          routeToDetailPage(photo, context);
        }
      },
      onLongPress: () {
        _selectPhoto(photo);
      },
      child: Container(
        margin: const EdgeInsets.all(2.0),
        decoration: BoxDecoration(
          border: _selectedPhotos.contains(photo)
              ? Border.all(width: 4.0, color: Colors.blue)
              : null,
        ),
        child: ImageWidget(photo),
      ),
    );
  }

  void _selectPhoto(Photo photo) {
    setState(() {
      if (_selectedPhotos.contains(photo)) {
        _selectedPhotos.remove(photo);
      } else {
        _selectedPhotos.add(photo);
      }
      if (_selectedPhotos.isNotEmpty) {
        _shouldSelectOnTap = true;
      } else {
        _shouldSelectOnTap = false;
      }
      widget.photoSelectionChangeCallback(_selectedPhotos);
    });
  }

  void routeToDetailPage(Photo photo, BuildContext context) {
    Logger().i("Photo index: " + widget.photos.indexOf(photo).toString());
    final page = DetailPage(widget.photos, widget.photos.indexOf(photo));
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (BuildContext context) {
          return page;
        },
      ),
    );
  }

  void _collatePhotos() {
    final dailyPhotos = List<Photo>();
    final collatedPhotos = List<List<Photo>>();
    for (int index = 0; index < widget.photos.length; index++) {
      if (index > 0 &&
          !_arePhotosFromSameDay(
              widget.photos[index], widget.photos[index - 1])) {
        var collatedDailyPhotos = List<Photo>();
        collatedDailyPhotos.addAll(dailyPhotos);
        collatedPhotos.add(collatedDailyPhotos);
        dailyPhotos.clear();
      }
      dailyPhotos.add(widget.photos[index]);
    }
    if (dailyPhotos.isNotEmpty) {
      collatedPhotos.add(dailyPhotos);
    }
    _collatedPhotos.clear();
    _collatedPhotos.addAll(collatedPhotos);
  }

  bool _arePhotosFromSameDay(Photo firstPhoto, Photo secondPhoto) {
    var firstDate =
        DateTime.fromMicrosecondsSinceEpoch(firstPhoto.createTimestamp);
    var secondDate =
        DateTime.fromMicrosecondsSinceEpoch(secondPhoto.createTimestamp);
    return firstDate.year == secondDate.year &&
        firstDate.month == secondDate.month &&
        firstDate.day == secondDate.day;
  }
}
